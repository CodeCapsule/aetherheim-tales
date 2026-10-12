// Finding your way without markers: tall landmarks in every zone, waystones you activate on foot (the only fast
// travel), spoken directions tied to landmarks (kept word for word in the journal), hidden ruins and lore books
// (discovery XP), Survey Maps that cartographers copy and trade, and the fair-play check for macro-like input.
import * as THREE from 'three';
import { ZONES, TELEPORTS, ITEMS, SPAWNS, MONSTERS } from './data.js';
import { LANDMARK_DEFS, HIDDEN_DEFS, LORE_DEFS, SURVEY_MIN_MASTERY, SURVEY_COVER, zoneKey } from './data-nav.js';
import { FOG } from './progress.js';
import { toon, glow, glowTexture } from './toon.js';

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DIRS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
// north is -z on every map in the game
export const dirWord = (dx, dz) => DIRS[((Math.round(Math.atan2(dx, -dz) / (Math.PI / 4)) % 8) + 8) % 8];
const howFar = (d) => (d < 60 ? 'a short walk' : d < 140 ? 'a fair walk' : d < 260 ? 'a long way' : 'a very long way');
export const WALK_MAX = 60; // the farthest a single click walks you: beyond it you find the way yourself
const at = (z, a, d) => ({ x: z.x + Math.sin(a * Math.PI / 180) * z.r * d, z: z.z - Math.cos(a * Math.PI / 180) * z.r * d });
const zoneMinLv = (z) => { const m = /Lv (\d+)/.exec(z.lv || ''); return m ? +m[1] : z.safe ? 0 : 999; };

// ---------------------------------------------------------------- landmark models (14-22 m, a glow on top)
function landmarkModel(kind, color) {
  const g = new THREE.Group(), stone = toon(0x8a8478), c = toon(color);
  const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.y = ry; m.castShadow = true; g.add(m); return m; };
  let top = 16, r = 1.6;
  if (kind === 'spire') { add(new THREE.CylinderGeometry(0.35, 1.5, 18, 8), c, 0, 9, 0); top = 18.4; r = 1.6; }
  else if (kind === 'beacon') { add(new THREE.CylinderGeometry(1.6, 2.1, 13, 9), stone, 0, 6.5, 0); add(new THREE.CylinderGeometry(2.3, 2.3, 1.2, 9), c, 0, 13.6, 0); add(new THREE.ConeGeometry(0.9, 2.2, 8), glow(color), 0, 15.3, 0); top = 15.6; r = 2.2; }
  else if (kind === 'tree') { add(new THREE.CylinderGeometry(1.1, 1.9, 13, 9), toon(0x6a4a2a), 0, 6.5, 0); for (const [x, y, z, s] of [[0, 15, 0, 5.5], [2.6, 12.6, 1.4, 3.8], [-2.4, 13, -1.2, 4]]) add(new THREE.DodecahedronGeometry(1, 1), c, x, y, z, s, s * 0.8, s); top = 19; r = 2; }
  else if (kind === 'statue') { add(new THREE.BoxGeometry(4, 2, 4), stone, 0, 1, 0); add(new THREE.CylinderGeometry(1.1, 1.6, 8, 8), c, 0, 6, 0); add(new THREE.SphereGeometry(1.4, 10, 8), c, 0, 11.2, 0); add(new THREE.BoxGeometry(5.2, 0.9, 0.9), c, 0, 8.6, 0); top = 13; r = 2.6; }
  else if (kind === 'arch') { for (const s of [-1, 1]) add(new THREE.BoxGeometry(1.6, 11, 1.6), c, s * 3.4, 5.5, 0); add(new THREE.BoxGeometry(9.4, 1.6, 2), c, 0, 11.6, 0); top = 12.8; r = 0; }
  else if (kind === 'crystal') { add(new THREE.OctahedronGeometry(1, 0), glow(color), 0, 8, 0, 2.4, 8, 2.4); add(new THREE.OctahedronGeometry(1, 0), glow(color), 2.4, 4, 1, 1.2, 4, 1.2, 0.6); add(new THREE.OctahedronGeometry(1, 0), glow(color), -2, 3.4, -1.2, 1, 3.4, 1); top = 16; r = 2.4; }
  else if (kind === 'totem') { for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(2.4 - i * 0.2, 2.6, 2.4 - i * 0.2), i % 2 ? c : stone, 0, 1.3 + i * 2.6, 0, 1, 1, 1, i * 0.5); add(new THREE.OctahedronGeometry(0.9, 0), glow(color), 0, 12, 0); top = 12.4; r = 1.7; }
  else if (kind === 'obelisk') { add(new THREE.CylinderGeometry(0.5, 1.6, 16, 4), c, 0, 8, 0, 1, 1, 1, Math.PI / 4); add(new THREE.ConeGeometry(0.55, 1.4, 4), glow(0xfff0b0), 0, 16.7, 0, 1, 1, 1, Math.PI / 4); top = 17; r = 1.5; }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85, fog: false }));
  sp.position.y = top; sp.scale.setScalar(5); sp.raycast = () => {}; g.add(sp);
  g.userData.r = r;
  return g;
}
function waystoneModel() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 0.5, 8), toon(0x8a8478)); base.position.y = 0.25; g.add(base);
  const st = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.7, 3.4, 6), toon(0xa8a090)); st.position.y = 2.1; g.add(st);
  const rune = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.09, 6, 24), new THREE.MeshBasicMaterial({ color: 0x5a6070 })); rune.position.y = 2.6; g.add(rune);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0), new THREE.MeshBasicMaterial({ color: 0x5a6070 })); gem.position.y = 4.2; g.add(gem);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x7ad8ff, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 })); sp.position.y = 4.2; sp.scale.setScalar(4); sp.raycast = () => {}; g.add(sp);
  g.userData = { rune, gem, sp };
  return g;
}
function ruinModel() {
  const g = new THREE.Group(), st = toon(0x9a9488);
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, h = 0.8 + ((i * 37) % 10) / 4; const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, h, 0.8), st); m.position.set(Math.cos(a) * 4, h / 2, Math.sin(a) * 4); m.rotation.y = a; g.add(m); }
  const alt = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.2, 0.8, 8), st); alt.position.y = 0.4; g.add(alt);
  return g;
}
function lecternModel() {
  const g = new THREE.Group(), wood = toon(0x7a4a2a);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.2, 0.3), wood); post.position.y = 0.6; g.add(post);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.7), wood); top.position.y = 1.25; top.rotation.x = -0.4; g.add(top);
  const book = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.5), toon(0xe8dcc0)); book.position.set(0, 1.33, 0.02); book.rotation.x = -0.4; g.add(book);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffe8a0, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5 })); sp.position.y = 1.5; sp.scale.setScalar(1.8); sp.raycast = () => {}; g.add(sp);
  return g;
}

const N = {
  // ================================================================ building
  initNavigation() {
    const W = this.world, S = this.S;
    S.waystones = S.waystones || [];
    S.journal = S.journal || [];
    const avoid = [...TELEPORTS.map((t) => ({ x: t.x, z: t.z })), ...this.npcs.map((n) => ({ x: n.pos.x, z: n.pos.z })), ...(this.portals || []).map((p) => ({ x: p.pos.x, z: p.pos.z }))];
    const place = (z, a, d) => {
      for (let k = 0; k < 8; k++) {
        const pt = at(z, a + k * 17, d);
        const [x, zz] = W.nearestFree(pt.x, pt.z);
        if (Math.abs(x) < 390 && Math.abs(zz) < 390 && avoid.every((q) => Math.hypot(q.x - x, q.z - zz) > 14)) return { x, z: zz };
      }
      const pt = at(z, a, d); return { x: pt.x, z: pt.z };
    };
    // landmarks
    this.landmarks = [];
    for (const z of ZONES) for (const L of LANDMARK_DEFS[z.name] || []) {
      if (L.kind === 'none') { this.landmarks.push({ name: L.name, zone: z.name, x: L.at[0], z: L.at[1], kind: 'none' }); continue; }
      const pos = place(z, L.a, L.d);
      const m = landmarkModel(L.kind, L.color); m.position.set(pos.x, W.heightAt(pos.x, pos.z), pos.z); W.root.add(m);
      if (m.userData.r) W.blockCircle(pos.x, pos.z, m.userData.r); else for (const s of [-1, 1]) W.blockCircle(pos.x + s * 3.4, pos.z, 1.2);
      avoid.push(pos);
      this.landmarks.push({ name: L.name, zone: z.name, kind: L.kind, color: L.color, ...pos });
    }
    // hidden ruins and lore books
    this.ruins = [];
    for (const z of ZONES) {
      const H = HIDDEN_DEFS[z.name];
      if (H) { const pos = place(z, H.a, H.d); const m = ruinModel(); m.position.set(pos.x, W.heightAt(pos.x, pos.z), pos.z); W.root.add(m); W.blockCircle(pos.x, pos.z, 1.2); avoid.push(pos); this.ruins.push({ name: H.name, zone: z.name, ...pos }); }
      const B = LORE_DEFS[z.name];
      if (B) {
        const pos = place(z, B.a, B.d), m = lecternModel(); m.position.set(pos.x, W.heightAt(pos.x, pos.z), pos.z); W.root.add(m); W.blockCircle(pos.x, pos.z, 0.5); avoid.push(pos);
        const e = { kind: 'lore', model: m, pos: m.position, height: 1.6, radius: 0.9, map: W, dead: false, name: B.title, text: B.text, zone: z.name };
        this.nameplate(e, `<div class="t">&lt;Lore&gt;</div><div class="n">${esc(B.title)}</div>`, 'npc node'); e.npY = 2;
        this.lifeEnts.push(e);
      }
    }
    // waystones: one at every teleport point; Sylvan Haven's is always awake
    this.waystoneEnts = TELEPORTS.map((t, i) => {
      const [x, z] = i === 0 ? [t.x, t.z] : W.nearestFree(t.x, t.z);
      const m = waystoneModel(); m.position.set(x + (i === 0 ? 5 : 0), W.heightAt(x, z), z); W.root.add(m);
      W.blockCircle(m.position.x, m.position.z, 1);
      const e = { kind: 'waystone', model: m, pos: m.position, height: 4.4, radius: 1.4, map: W, dead: false, name: `${t.name} Waystone`, idx: i };
      this.nameplate(e, `<div class="t">&lt;Waystone&gt;</div><div class="n">${esc(t.name)}</div>`, 'npc node'); e.npY = 5;
      this.lifeEnts.push(e);
      return e;
    });
    if (!S.waystones.includes(TELEPORTS[0].name)) S.waystones.push(TELEPORTS[0].name);
    // the explored map: the town is known; heroes from before the fog keep the zones of their level and those waystones
    if (!S.fogInit) {
      S.fogInit = 1;
      this.revealCircle(0, 0, 70);
      if (S.level > 1) for (const z of ZONES) if (zoneMinLv(z) <= S.level) { this.revealCircle(z.x, z.z, z.r); const i = TELEPORTS.findIndex((t) => t.name === z.name); if (i > 0 && !S.waystones.includes(z.name)) S.waystones.push(z.name); }
    }
    for (const e of this.waystoneEnts) this.waystoneLook(e);
    this.navT = 0; this.macro = { win: [], reps: 0, since: Date.now() };
  },
  // Wayfarer's Garb (6): the map uncovers in a 30 m radius
  revealR() { return this.hasFx && this.hasFx('six_wayfarer6') ? 2 : 1; },
  waystoneOn(i) { return this.S.waystones.includes(TELEPORTS[i]?.name); },
  waystoneLook(e) {
    const on = this.waystoneOn(e.idx), u = e.model.userData;
    u.rune.material.color.setHex(on ? 0x7ad8ff : 0x5a6070); u.gem.material.color.setHex(on ? 0xbff0ff : 0x5a6070); u.sp.material.opacity = on ? 0.8 : 0;
    e.np.classList.toggle('dim', !on);
  },
  revealCircle(x, z, r) {
    const n = FOG.n, c = FOG.cell; let k0 = 0;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const cx = -FOG.size / 2 + (i + 0.5) * c, cz = -FOG.size / 2 + (j + 0.5) * c;
      if (Math.hypot(cx - x, cz - z) <= r && !this.fogBits[j * n + i]) { this.fogBits[j * n + i] = 1; k0++; }
    }
    if (k0) { this.fogDirty = true; this.ui.fogChanged && this.ui.fogChanged(); }
    return k0;
  },
  // share of a zone's ground you have uncovered
  zoneCoverage(z) {
    const n = FOG.n, c = FOG.cell; let tot = 0, seen = 0;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const cx = -FOG.size / 2 + (i + 0.5) * c, cz = -FOG.size / 2 + (j + 0.5) * c;
      if (Math.hypot(cx - z.x, cz - z.z) <= z.r) { tot++; if (this.fogBits[j * n + i]) seen++; }
    }
    return tot ? seen / tot : 0;
  },

  // ================================================================ per frame (twice a second)
  updateNavigation(dt) {
    if ((this.navT -= dt) > 0) return;
    this.navT = 0.5;
    const p = this.player, S = this.S;
    if (p.dead || this.map !== this.world) return;
    for (const e of this.waystoneEnts || []) {
      if (this.waystoneOn(e.idx) || flat(p.pos, e.pos) > 4.5) continue;
      S.waystones.push(TELEPORTS[e.idx].name); this.waystoneLook(e);
      this.fx.pillar(e.pos, 0x7ad8ff, 1.6, 12, 1); this.sfx.play('rare');
      this.ui.banner('WAYSTONE AWAKENED', `${TELEPORTS[e.idx].name} · fast travel from any waystone`, 'zone');
      if (!S.disc.waystones.includes(TELEPORTS[e.idx].name)) { S.disc.waystones.push(TELEPORTS[e.idx].name); this.discoverXp('waystone', `${esc(TELEPORTS[e.idx].name)} Waystone`); }
      this.save();
    }
    for (const r of this.ruins || []) {
      if (S.disc.hidden.includes(r.name) || flat(p.pos, r) > 7) continue;
      S.disc.hidden.push(r.name);
      this.ui.banner('HIDDEN PLACE FOUND', r.name.replace(/^the /, 'The '), 'zone'); this.sfx.play('rare');
      this.discoverXp('hidden', esc(r.name));
      this.gainMastery('survival', 12);
      // a discovery chest: Shadowstep pieces hide in such places (Lv 50+), otherwise coin and a little treasure
      if (S.level >= 50 && Math.random() < 0.35) this.giveSix('six_shadowstep', null, 'Discovery chest');
      else { const gold = 200 + S.level * 30; S.gold += gold; this.ui.toast(`Discovery chest: +${gold} Gold`, 'good'); this.ui.refreshWallet(); }
    }
  },
  readLore(e) {
    const S = this.S;
    this.ui.modal(e.name, e.text, [{ label: 'Close' }]);
    if (!S.disc.lore.includes(e.name)) { S.disc.lore.push(e.name); this.discoverXp('lore', `read “${esc(e.name)}”`); this.gainMastery('survival', 5); }
  },
  // walking up to a waystone: travel to any other awakened one
  useWaystone(e) {
    if (!this.waystoneOn(e.idx)) return;
    this.ui.modal('Waystone', 'Travel to an awakened waystone. Waystones you have not found on foot stay dark.', [
      ...TELEPORTS.map((t, i) => ({ t, i })).filter(({ i }) => i !== e.idx && this.waystoneOn(i)).map(({ t, i }) => ({ label: t.name, cls: 'blue', fn: () => { this.teleport(i); } })),
      { label: 'Stay', cls: 'gray' },
    ]);
  },

  // ================================================================ spoken directions
  nearestLandmark(x, z, maxD = 90, not = null) {
    let best = null, bd = maxD;
    for (const L of this.landmarks || []) { const d = Math.hypot(L.x - x, L.z - z); if (d < bd && L !== not) { bd = d; best = L; } }
    return best;
  },
  // directions in words tied to landmarks, from where you stand
  directionsTo(x, z, what) {
    const p = this.player.pos, d = Math.hypot(x - p.x, z - p.z);
    const zT = this.world.zoneAt(x, z, ZONES), zP = this.world.zoneAt(p.x, p.z, ZONES);
    const W = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    if (d < 20) return `${W(what)} is close by, to the ${dirWord(x - p.x, z - p.z)}.`;
    if (zT?.safe && zP?.safe) {
      const f = this.landmarks?.[0];
      return `${W(what)} is in Sylvan Haven, ${dirWord(x - (f?.x || 0), z - (f?.z || 0))} of ${f?.name || 'the fountain'}. From here, walk ${dirWord(x - p.x, z - p.z)}.`;
    }
    const goal = this.nearestLandmark(x, z, 80);
    const mid = this.nearestLandmark((p.x + x) / 2, (p.z + z) / 2, Math.max(40, d * 0.35), goal);
    let s = `Head ${dirWord(x - p.x, z - p.z)}, ${howFar(d)}`;
    s += zT && zT !== zP ? `, into ${zT.name}.` : '.';
    if (mid && Math.hypot(mid.x - p.x, mid.z - p.z) > 25 && Math.hypot(mid.x - x, mid.z - z) > 25) s += ` You will pass ${mid.name}.`;
    if (goal) s += Math.hypot(goal.x - x, goal.z - z) < 14 ? ` ${W(what)} is right beside ${goal.name}.` : ` Look for ${goal.name}: ${what} lies ${dirWord(x - goal.x, z - goal.z)} of it.`;
    else s += ` ${W(what)} lies there.`;
    return s;
  },
  // say the way (and keep the exact words in the journal)
  giveDirections(x, z, what, who = null, keep = true) {
    const text = this.directionsTo(x, z, what), said = who ? `${who}: “${text}”` : text;
    if (keep) this.journalAdd(said);
    this.ui.toast(text);
    this.ui.chat('system', `<b>Directions</b> · ${esc(said)}`);
    return text;
  },
  journalAdd(text) {
    const S = this.S;
    S.journal = [{ t: Date.now(), text }, ...(S.journal || []).filter((j) => j.text !== text)].slice(0, 30);
    if (this.ui.panelName === 'quests') this.ui.refreshPanel();
  },
  // where the current quest (or bounty) sends you
  questTarget(which = 'main') {
    if (which === 'bounty') {
      const B = this.S.bounty; if (!B) return null;
      if (B.status === 'complete') { const n = this.npcById('elena'); return n && { x: n.pos.x, z: n.pos.z, what: 'Captain Elena', npc: n }; }
      return this.spawnTarget(B.target);
    }
    const q = this.quest(); if (!q || !q.def) return null;
    const d = q.def;
    if (q.status === 'available' && d.minLv > this.S.level) return null;
    const npcT = (id) => { const n = this.npcById(id); return n && { x: n.pos.x, z: n.pos.z, what: `${n.data.name} the ${n.data.title}`, npc: n }; };
    if (q.status === 'available') return npcT(d.giver);
    if (q.status === 'complete') return npcT(d.turnin);
    if (d.type === 'kill' || d.type === 'collect') return this.spawnTarget(d.target);
    if (d.type === 'dungeon') { const h = (this.portals || []).find((x) => x.def?.id === d.target); return h && { x: h.pos.x, z: h.pos.z, what: `the entrance of ${h.def.name}`, portal: h }; }
    if (d.type === 'level') return null;
    return npcT(d.turnin);
  },
  spawnTarget(type) {
    const p = this.player.pos;
    const sp = SPAWNS.filter((s) => s.type === type).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    return sp && { x: sp.x, z: sp.z, what: `the ${MONSTERS[type].name} grounds` };
  },

  // ================================================================ cartography (Survival mastery)
  surveyZones() { return ZONES.filter((z) => !z.safe && ITEMS['survey_' + zoneKey(z.name)]); },
  copySurvey(zoneName) {
    const z = ZONES.find((x) => x.name === zoneName), id = z && 'survey_' + zoneKey(z.name);
    if (!id || !ITEMS[id]) return false;
    if (this.masteryLv('survival') < SURVEY_MIN_MASTERY) { this.ui.toast(`Copying maps needs Survival mastery ${SURVEY_MIN_MASTERY}`, 'warn'); return false; }
    const cov = this.zoneCoverage(z);
    if (cov < SURVEY_COVER) { this.ui.toast(`Explore more of ${z.name} first (${Math.round(cov * 100)}% of ${Math.round(SURVEY_COVER * 100)}%)`, 'warn'); return false; }
    if (!this.countItem('blank_parchment')) { this.ui.toast('You need a Blank Parchment (Hilda sells them)', 'warn'); return false; }
    if (!this.bagRoomFor(id)) { this.ui.toast('Bag is full!', 'warn'); return false; }
    this.removeItem('blank_parchment', 1); this.addItem(id, 1);
    this.gainMastery('survival', 6);
    this.sfx.play('upgrade'); this.ui.toast(`You copied a Survey Map of ${z.name}. Sell it or trade it to other explorers.`, 'good');
    this.ui.refreshPanel(); this.save();
    return true;
  },
  readSurvey(id) {
    const z = ZONES.find((x) => 'survey_' + zoneKey(x.name) === id); if (!z) return false;
    const n = this.revealCircle(z.x, z.z, z.r);
    this.removeItem(id, 1); this.sfx.play('quest');
    this.ui.toast(n ? `The map of ${z.name} is now on yours (${n} new areas)` : `You already knew all of ${z.name}`, 'good');
    this.save();
    return true;
  },

  // ================================================================ fair play: macro-like input
  // The same input sequence with identical timing, repeated for a long time, flags the account for a person to
  // review (nothing is done automatically).
  noteInput(tag) {
    const M = this.macro; if (!M) return;
    const now = performance.now(), dt = M.last ? Math.min(99, Math.round((now - M.last) / 100)) : 0; M.last = now;
    M.win.push(tag + ':' + dt); if (M.win.length > 40) M.win.shift();
    if (M.win.length < 40) return;
    const a = M.win.slice(0, 20).join('|'), b = M.win.slice(20).join('|');
    if (a === b) M.reps++; else { M.reps = 0; M.since = Date.now(); }
    if (M.reps >= 400 && Date.now() - M.since > 45 * 60000 && !this.S.flags?.macro) {
      this.S.flags = { ...(this.S.flags || {}), macro: { t: Date.now(), reps: M.reps } };
      this.liveFlag && this.liveFlag('macro');
    }
  },
};

export function installNavigation(Game) { Object.assign(Game.prototype, N); }
