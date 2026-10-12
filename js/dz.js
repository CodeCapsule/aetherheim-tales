// The Danger Zone (Bloodmoon Wastes): entering and leaving, player-versus-player hits between real players, items
// dropped on death, loot sacks anyone can grab, Ancient set drops, and the blood-red sky.
// Networking: every client is authoritative for itself. An attacker sends its raw hit ('z' broadcast, t: 'hit'); the
// victim applies its own defense and reductions. A fallen player's client owns its loot sack and grants it to the
// first player who reaches it (t: 'take' -> t: 'grant'), so an item can never be picked up twice.
import * as THREE from 'three';
import { ITEMS, SLOTS } from './data.js';
import { DZ, inDZ, DZ_DROP, PVP_DMG, dzLevel, ANCIENT_DROP } from './data-dz.js';
import { ANCIENT_SETS, SETS } from './data-sets.js';
import { RARITY, genSet, normalizeItem, EFFECTS } from './loot.js';
import { MATERIALS } from './systems-data.js';
import { mp } from './mp.js';
import { toon, glowTexture } from './toon.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v, lo, hi, d = 0) => { v = +v; return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
const str = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]/g, '').slice(0, n);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const DZ_FOG = new THREE.Color(0x6a1a1e);
const PICK_R = 1.8;
export const DZ_ZONE = { name: DZ.name, x: DZ.x, z: DZ.z, r: DZ.r, lv: 'Danger Zone · PvP', dz: true };

// a piece of gear that came over the network: keep known fields, clamp numbers, cap strings
function cleanEq(eq, cls) {
  if (!eq || typeof eq !== 'object' || !SLOTS.includes(eq.slot)) return null;
  const nums = (o) => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).slice(0, 16).map(([k, v]) => [str(k, 16), num(v, -1e7, 1e7, 0)]));
  const out = {
    uid: 0, slot: eq.slot, name: str(eq.name, 48) || 'Gear', quality: num(eq.quality, 0, 6, 0) | 0, lvl: num(eq.lvl, 1, 200, 1) | 0, stats: nums(eq.stats),
    affixes: (Array.isArray(eq.affixes) ? eq.affixes : []).slice(0, 6).map((a) => ({ id: str(a?.id, 24), v: num(a?.v, -1e6, 1e6, 0) })),
    effect: EFFECTS[eq.effect] ? eq.effect : null, named: eq.named ? str(eq.named, 32) : null, set: SETS[eq.set] ? eq.set : null,
    enh: num(eq.enh, 0, 15, 0) | 0, icon: str(eq.icon, 32), flavor: str(eq.flavor, 160), gems: (Array.isArray(eq.gems) ? eq.gems : []).slice(0, 5).map((x) => (x == null ? null : str(x, 32))), lock: false,
  };
  if (eq.xs) out.xs = num(eq.xs, 0, 2, 0) | 0;
  return normalizeItem(out, cls);
}

const Z = {
  dzInit() {
    this.dzBags = []; this.dzIn = false; this.dzFx = 0; this.dzBagN = 0;
    this.S.pk = this.S.pk || { kills: 0, deaths: 0 };
  },
  dzInside() { return !this.dg && !this.war && inDZ(this.player.pos.x, this.player.pos.z); },
  // ============================================================ per frame
  dzUpdate(dt) {
    const inside = this.dzInside();
    if (inside !== this.dzIn) { this.dzIn = inside; this.dzEnterLeave(inside); }
    // the sky turns blood red inside
    const target = inside ? 1 : 0;
    if (Math.abs(this.dzFx - target) > 0.001 || target) {
      if (!this.dzFog) this.dzFog = this.scene.fog.color.clone();
      this.dzFx += (target - this.dzFx) * (1 - Math.exp(-dt * 2.5));
      const base = this.skyFog || this.dzFog; // the day and night colour when the sky cycle runs
      this.scene.fog.color.copy(base).lerp(DZ_FOG, this.dzFx * 0.8);
      if (!inside && this.dzFx < 0.002) { this.scene.fog.color.copy(base); this.dzFog = null; this.dzFx = 0; }
    }
    // loot sacks: bob, expire, and get picked up when you walk over them
    const now = Date.now(), p = this.player;
    for (const b of [...this.dzBags]) {
      b.model.position.y = this.world.heightAt(b.pos.x, b.pos.z) + 0.15 + Math.sin(this.time * 3 + b.seed) * 0.08;
      b.model.rotation.y += dt * 0.8;
      const left = b.until - now;
      if (left <= 0) { this.dzRemoveBag(b.id); continue; }
      if ((this.frameN = (this.frameN || 0) + 1) % 20 === 0) b.npT.textContent = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
      if (!p.dead && !this.dg && !this.war && flat(p.pos, b.pos) < PICK_R && (b.asked || 0) < this.time) { b.asked = this.time + 1.5; this.dzTake(b); }
    }
  },
  dzEnterLeave(inside) {
    this.ui.setDZ(inside);
    this.mpLastSent = null; // tell the others right away (hp bars and PvP depend on it)
    if (inside) {
      // idle monsters re-roll to a few levels above you (you may have leveled since they spawned)
      for (const m of this.monsters) if (m.dz && !m.dead && !m.target && !m.tagged && Math.abs(m.level - this.dzMonsterLevel(m)) > 3) this.respawn(m, false);
      this.ui.banner('DANGER ZONE', 'PvP is on · fall here and you drop items', 'dz');
      this.ui.chat('announce', `<b>[Danger Zone]</b> You entered the <b>${esc(DZ.name)}</b>. Other players can attack you here (party members excepted). If you fall you drop ${Math.round(DZ_DROP.goldPct * 100)}% of your gold and up to ${DZ_DROP.items} unlocked bag items on the spot. Monsters are lethal and drop <span style="color:#ff6a3a">Ancient set</span> pieces.`);
      if (this.S.level < DZ.minLv) this.ui.toast(`Monsters here scale to your level and hit like bosses. Lv ${DZ.minLv}+ is recommended.`, 'warn');
      this.sfx.play('boom');
    } else this.ui.toast('You left the Danger Zone', 'good');
  },
  // ============================================================ monsters
  // Danger Zone monsters are always a few levels above you, and some of them are tinted blood red
  dzMonsterLevel(e) { return dzLevel(e.def0, this.S.level); },
  dzTint(e) {
    e.inner.traverse((m) => {
      if (!m.isMesh || !m.material || m.material.isShaderMaterial || m.userData.dzTinted) return;
      m.material = m.material.clone(); m.userData.dzTinted = true;
      if (m.material.color) m.material.color.lerp(new THREE.Color(0x8a1a1a), 0.45);
    });
  },
  // Ancient set pieces drop only here
  dzKill(m) {
    const d = m.def0; if (!d.dz) return;
    const ch = d.boss ? ANCIENT_DROP.boss : d.elite ? ANCIENT_DROP.elite : ANCIENT_DROP.normal;
    if (Math.random() < ch) {
      const sets = Object.keys(ANCIENT_SETS), id = sets[(Math.random() * sets.length) | 0], set = ANCIENT_SETS[id];
      const eq = genSet(id, { slot: set.slots[(Math.random() * set.slots.length) | 0], lvl: m.level, cls: this.S.cls, uid: this.S.uid++, ancientOk: this.ancientAllowed() });
      if (eq.quality === 7) this.noteAncient(eq);
      this.dropLoot({ eq }, m.pos);
      this.ui.chat('announce', `<b>[Announcement]</b> ${esc(this.S.name)} tore <span style="color:#ff6a3a">[${esc(eq.name)}]</span> from the Bloodmoon Wastes!`);
      this.logEvent && this.logEvent('set', `Ancient ${eq.name}`, true);
    }
  },
  // ============================================================ PvP
  // a remote player you may attack right now: both inside, not in your party, alive
  pvpFoe(e) {
    if (!e || e.kind !== 'rp' || e.netHidden || !this.dzIn || this.player.dead) return false;
    const pr = mp.peers.get(e.peerId); if (!pr) return false;
    return inDZ(e.pos.x, e.pos.z) && !this.partyHas(e.peerId) && pr.net.s !== 4 && (pr.net.h ?? 100) > 0;
  },
  // your hit on another player: sent raw, the victim applies its own armor (returns the damage shown here)
  pvpStrike(src, dst, mult, o) {
    if ((src !== this.player && src.kind !== 'pet') || !this.pvpFoe(dst)) return 0;
    const fixed = o.fixed != null;
    let raw = fixed ? o.fixed : this.atkOf(src) * mult * (0.9 + Math.random() * 0.2), crit = false;
    if (!fixed) {
      crit = o.canCrit !== false && Math.random() * 100 < this.critOf(src);
      if (crit) { let cd = src.critDmg ?? 0.6; for (const b of src.buffs || []) if (b.mods?.critDmg) cd += b.mods.critDmg; raw *= 1 + cd; }
      if (src === this.player) { const X = this.cbOut(dst, o); raw *= X.m; }
      if (this.hasFx('anc_king')) raw *= 1.3;
      if (this.hasFx('set_covenant')) raw *= 1.15;
    }
    raw = Math.round(raw);
    if (mp.status === 'online' && mp.channel) mp.channel.send({ type: 'broadcast', event: 'z', payload: { i: mp.id, t: 'hit', to: dst.peerId, raw, crit: crit ? 1 : 0, lv: this.S.level } }).catch(() => {});
    // what it roughly does after their armor (their defense is not shared, so this is an estimate)
    const K = 50 + 8 * this.S.level, est = Math.max(1, Math.round(raw * PVP_DMG * K / (K + 3 + 2.4 * (dst.level || 1))));
    const head = dst.pos.clone().setY(dst.pos.y + (dst.height || 2) * 0.9);
    this.fx.text(head, String(est), o.cls || (crit ? 'crit' : 'dmg'));
    this.fx.emit(head, { count: crit ? 16 : 8, color: crit ? 0xffb02a : 0xff6a5a, speed: 4, life: 0.3, size: 0.4 });
    if (!o.proc) this.sfx.play(crit ? 'crit' : 'hit');
    dst.hitT = 0.15; this.lastCombat = this.time;
    if (src === this.player && !o.proc) {
      const ls = Math.min(25, this.stat('lifesteal') + (this.petIs('vampire') ? this.petFx.v : 0) + this.ps('lifesteal'));
      if (ls > 0) this.player.hp = Math.min(this.player.maxHp, this.player.hp + est * ls / 100);
    }
    return est;
  },
  // another player's hit on you
  pvpTakeHit(pr, m) {
    const p = this.player;
    if (p.dead || !this.dzIn) return;
    const e = this.rplayers.find((x) => x.peerId === pr.info.id);
    if (!e || !inDZ(e.pos.x, e.pos.z) || this.partyHas(e.peerId)) return;
    const raw = num(m.raw, 0, 1e9, 0); if (!raw) return;
    if (Math.random() * 100 < this.ps('dodge') || (this.petIs('dodge') && Math.random() * 100 < this.petFx.v)) { this.fx.text(p.pos.clone().setY(p.pos.y + p.height), 'Dodge', 'miss'); return; }
    const K = 50 + 8 * num(m.lv, 1, 200, 1);
    let dmg = raw * PVP_DMG * K / (K + this.defOf(p)) * this.buffMod(p, 'dmgTaken');
    if (this.petIs('guard') || this.petIs('guardian')) dmg *= 1 - this.petFx.v / 100;
    if (this.hasFx('set_covenant')) dmg *= 0.85;
    if (this.hasFx('anc_dread')) dmg *= 0.8;
    this.lastHitBy = e;
    this.damage(e, p, 0, { fixed: Math.max(1, Math.round(dmg)), pvp: true });
  },
  // AoE skills also catch enemy players inside the zone
  pvpAoe(c, r, mult, proc, sk) {
    if (!this.dzIn) return;
    for (const e of this.rplayers || []) if (this.pvpFoe(e) && flat(e.pos, c) < r + 0.5) this.damage(this.player, e, mult, { proc, sk });
  },
  // ============================================================ falling inside: drop part of your bag and gold
  dzOnDeath(src) {
    const S = this.S, p = this.player;
    S.pk.deaths++;
    const gold = Math.floor(S.gold * DZ_DROP.goldPct); S.gold -= gold;
    const cand = S.bag.map((b, i) => i).filter((i) => { const b = S.bag[i]; return b.eq ? !b.eq.lock && !this.isBound(b.eq) : ITEMS[b.id] && ITEMS[b.id].type !== 'quest'; });
    const pickIdx = [];
    while (pickIdx.length < DZ_DROP.items && cand.length) pickIdx.push(cand.splice((Math.random() * cand.length) | 0, 1)[0]);
    pickIdx.sort((a, b) => b - a);
    const items = pickIdx.map((i) => S.bag.splice(i, 1)[0]).map((b) => (b.eq ? { eq: b.eq } : { id: b.id, qty: b.qty }));
    const bag = { id: `${mp.id || 'me'}-${++this.dzBagN}-${Date.now() % 100000}`, owner: mp.id || 'me', ownerName: S.name, x: p.pos.x, z: p.pos.z, gold, items, until: Date.now() + DZ_DROP.keepSecs * 1000 };
    if (gold || items.length) {
      this.dzMakeBag(bag, true);
      this.ui.chat('system', `You dropped ${items.length} item${items.length === 1 ? '' : 's'}${gold ? ` and ${gold.toLocaleString()} Gold` : ''} in the Danger Zone. Get back within ${Math.round(DZ_DROP.keepSecs / 60)} minutes to take them back before someone else does!`);
    }
    this.ui.refreshWallet(); this.ui.refreshPanel(); this.save();
    if (mp.status === 'online' && mp.channel) {
      if (gold || items.length) mp.channel.send({ type: 'broadcast', event: 'z', payload: { i: mp.id, t: 'drop', bag: { id: bag.id, x: bag.x, z: bag.z, gold, until: bag.until, items } } }).catch(() => {});
      mp.channel.send({ type: 'broadcast', event: 'z', payload: { i: mp.id, t: 'dead', by: src?.kind === 'rp' ? src.peerId : null, x: p.pos.x, z: p.pos.z } }).catch(() => {});
    }
  },
  // ============================================================ loot sacks
  dzMakeBag(b, mine) {
    if (this.dzBags.some((x) => x.id === b.id)) return;
    const g = new THREE.Group();
    const sack = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), toon(0x7a1a22)); sack.scale.set(1, 0.85, 1); sack.position.y = 0.45; g.add(sack);
    const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.3, 10), toon(0xffc83a)); tie.position.y = 0.95; g.add(tie);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff4a2a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    halo.scale.setScalar(2.4); halo.position.y = 0.6; g.add(halo);
    g.position.set(b.x, this.world.heightAt(b.x, b.z), b.z);
    this.scene.add(g);
    const e = { kind: 'dzbag', id: b.id, owner: b.owner, ownerName: b.ownerName, mine, items: b.items, gold: b.gold, until: b.until, model: g, pos: g.position, height: 1.2, radius: 0.8, map: this.world, dead: false, seed: Math.random() * 6 };
    this.nameplate(e, `<div class="t">&lt;Loot of ${esc(b.ownerName)}&gt;</div><div class="n">5:00</div>`, 'npc dzbag');
    e.npT = e.np.querySelector('.n'); e.npY = 1.6;
    this.dzBags.push(e);
  },
  dzRemoveBag(id) {
    const b = this.dzBags.find((x) => x.id === id); if (!b) return;
    this.scene.remove(b.model); b.np?.remove();
    this.dzBags = this.dzBags.filter((x) => x !== b);
  },
  // walking over a sack: yours (or an offline copy) you take at once; someone else's you ask its owner for
  dzTake(b) {
    if (b.mine) { this.dzGrant(b, null); return; }
    if (mp.status !== 'online' || !mp.channel || !mp.peers.has(b.owner)) { this.ui.toast('Its owner left: the loot crumbles to dust', 'warn'); this.dzRemoveBag(b.id); return; }
    mp.channel.send({ type: 'broadcast', event: 'z', payload: { i: mp.id, t: 'take', id: b.id, to: b.owner } }).catch(() => {});
  },
  // the owner hands a sack to whoever reached it first (null = to yourself)
  dzGrant(b, to) {
    if (!this.dzBags.includes(b)) return;
    this.dzRemoveBag(b.id);
    if (!to) { this.dzReceive(b.items, b.gold, b.ownerName); if (mp.status === 'online' && mp.channel) mp.channel.send({ type: 'broadcast', event: 'z', payload: { i: mp.id, t: 'gone', id: b.id } }).catch(() => {}); return; }
    mp.channel.send({ type: 'broadcast', event: 'z', payload: { i: mp.id, t: 'grant', id: b.id, to } }).catch(() => {});
    const pr = mp.peers.get(to);
    this.ui.chat('system', `<b>${esc(pr?.info.name || 'Someone')}</b> took your dropped loot.`);
  },
  dzReceive(items, gold, from) {
    const S = this.S, got = [];
    for (const it of items || []) {
      if (it.eq) { const eq = cleanEq(it.eq, S.cls); if (!eq) continue; eq.uid = S.uid++; if (this.addEquip(eq)) got.push(`<span style="color:${RARITY[eq.quality].color}">[${esc(eq.name)}]</span>`); }
      else if (ITEMS[it.id]) { const q = num(it.qty, 1, 999, 1) | 0; if (this.addItem(it.id, q)) got.push(`[${esc(ITEMS[it.id].name)}] x${q}`); }
      else if (MATERIALS[it.id]) { const q = num(it.qty, 1, 9999, 1) | 0; this.addMat(it.id, q, true); got.push(`[${esc(MATERIALS[it.id].name)}] x${q}`); }
    }
    const g = num(gold, 0, 1e12, 0) | 0;
    if (g) S.gold += g;
    this.sfx.play('chest'); this.fx.buff(this.player, '#ff6a3a');
    this.ui.chat('system', `You took ${from === S.name ? 'back your' : `the loot of <b>${esc(from)}</b>:`} ${got.join(', ') || 'nothing'}${g ? ` and ${g.toLocaleString()} Gold` : ''}.`);
    this.ui.refreshWallet(); this.ui.refreshPanel(); this.save();
  },
  // ============================================================ network
  dzMsg(m) {
    if (!m || typeof m !== 'object') return;
    const from = str(m.i, 40), pr = mp.peers.get(from); if (!pr) return;
    switch (m.t) {
      case 'hit': if (m.to === mp.id) this.pvpTakeHit(pr, m); break;
      case 'dead': {
        const by = m.by && (m.by === mp.id ? this.S.name : mp.peers.get(m.by)?.info.name);
        if (m.by === mp.id) {
          this.S.pk.kills++;
          this.ui.toast(`You defeated ${pr.info.name}!`, 'good'); this.sfx.play('level');
          if (this.hasFx('anc_bloodthirst')) this.ancBloodthirst();
        }
        this.ui.chat('announce', `<b>[Danger Zone]</b> ${esc(pr.info.name)} ${by ? `was slain by <b>${esc(by)}</b>` : 'fell'} in the ${esc(DZ.name)}.`);
        break;
      }
      case 'drop': {
        const b = m.bag; if (!b || typeof b !== 'object') return;
        const x = num(b.x, -400, 400, 0), z = num(b.z, -400, 400, 0);
        if (!inDZ(x, z)) return;
        this.dzMakeBag({ id: str(b.id, 64), owner: from, ownerName: pr.info.name, x, z, gold: num(b.gold, 0, 1e12, 0), items: Array.isArray(b.items) ? b.items.slice(0, 5) : [], until: Math.min(Date.now() + DZ_DROP.keepSecs * 1000, num(b.until, 0, 1e15, 0)) }, false);
        break;
      }
      case 'take': { // someone reached my sack
        if (m.to !== mp.id) return;
        const b = this.dzBags.find((x) => x.id === m.id && x.mine);
        if (b) this.dzGrant(b, from);
        break;
      }
      case 'grant': {
        const b = this.dzBags.find((x) => x.id === m.id && x.owner === from); if (!b) return;
        if (m.to === mp.id) { const items = b.items, gold = b.gold; this.dzRemoveBag(b.id); this.dzReceive(items, gold, b.ownerName); }
        else this.dzRemoveBag(b.id);
        break;
      }
      case 'gone': { const b = this.dzBags.find((x) => x.id === m.id && x.owner === from); if (b) this.dzRemoveBag(b.id); break; }
    }
  },
  // a player left: their sacks can no longer be granted
  dzPeerGone(key) { for (const b of [...this.dzBags]) if (b.owner === key) this.dzRemoveBag(b.id); },
  // ============================================================ Ancient set powers
  ancBloodthirst() {
    const p = this.player; this.heal(p, p.maxHp * 0.08);
    p.buffs = p.buffs.filter((b) => b.id !== 'bloodthirst');
    p.buffs.push({ id: 'bloodthirst', icon: 'soul_frenzy', until: this.time + 6, mods: { atk: 1.25 } });
  },
};
export function installDangerZone(Game) { Object.assign(Game.prototype, Z); }
