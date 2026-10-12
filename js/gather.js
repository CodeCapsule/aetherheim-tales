// Gathering tools: which tool a node needs, the tool in your hands while you chop / mine / harvest, the swing loop
// with its impacts (the node shakes and throws chips, sparks or leaves), and forging better tools at Gorm's.
import * as THREE from 'three';
import { ITEMS } from './data.js';
import { TOOL_KINDS, TOOL_FOR_NODE, TOOL_TIERS, TOOL_METAL, TOOL_ITEMS, TOOL_RECIPES, STARTER_TOOLS, toolId } from './data-crafting.js';
import { registerIcon } from './icons.js';
import { toon } from './toon.js';

// swing length (s) and the moment in the swing (0-1) the tool lands
const SWING = { chop: 0.8, mine: 0.85, harvest: 0.7 };
const IMPACT = { chop: 0.55, mine: 0.56, harvest: 0.5 };
// how close the hero steps in to swing at each kind of node
const REACH = { tree: 1.75, ore: 2.3, herb: 1.05 };

// ---------------------------------------------------------------- icons (one per tool, tinted by metal)
const INK = 'stroke="#24160f" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
function toolIcon(kind, metal) {
  const haft = '<linearGradient id="hf" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c8905a"/><stop offset="1" stop-color="#7a4a22"/></linearGradient>';
  const met = `<linearGradient id="mt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="${metal}"/><stop offset="1" stop-color="${metal}" stop-opacity=".75"/></linearGradient>`;
  const body = {
    axe: `<g transform="rotate(-38 32 34)"><rect x="29" y="10" width="6.5" height="48" rx="3" fill="url(#hf)" ${INK}/>
      <path d="M34 11C47 7 56 15 54 31C49 27 42 26 34 28Z" fill="url(#mt)" ${INK}/><rect x="27" y="11" width="10" height="14" rx="2.5" fill="url(#mt)" ${INK}/></g>`,
    pick: `<g transform="rotate(-38 32 34)"><rect x="29" y="12" width="6.5" height="46" rx="3" fill="url(#hf)" ${INK}/>
      <path d="M6 24Q32 4 58 24L54 27Q32 13 10 27Z" fill="url(#mt)" ${INK}/><rect x="27.5" y="12" width="9" height="9" rx="2" fill="url(#mt)" ${INK}/></g>`,
    sickle: `<rect x="27" y="38" width="7" height="22" rx="3" fill="url(#hf)" ${INK} transform="rotate(28 30 49)"/>
      <path d="M29 40C14 33 12 13 28 6C44 0 58 11 55 26C51 16 43 11 35 13C25 17 25 29 34 37Z" fill="url(#mt)" ${INK}/>`,
  }[kind];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${haft}${met}</defs>${body}<ellipse cx="22" cy="18" rx="3" ry="1.6" fill="#fff" opacity=".8" transform="rotate(-35 22 18)"/></svg>`;
}
for (const [id, it] of Object.entries(TOOL_ITEMS)) registerIcon(id, toolIcon(it.tool, TOOL_METAL[it.tier]));

// ---------------------------------------------------------------- 3D tools for the hero's right hand
const geo = { haft: new THREE.CylinderGeometry(0.035, 0.04, 0.78, 8), axeHead: null, pickHead: null, sickle: null };
function toolModel(kind, tier) {
  const g = new THREE.Group(), metal = toon(new THREE.Color(TOOL_METAL[tier]).getHex()), wood = toon(0x8a5a2a);
  const haft = new THREE.Mesh(geo.haft, wood); haft.position.y = 0.3; g.add(haft);
  if (kind === 'axe') {
    const blade = new THREE.Mesh(geo.axeHead ||= new THREE.BoxGeometry(0.06, 0.24, 0.26), metal); blade.position.set(0, 0.62, 0.12); g.add(blade);
    const edge = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 12, 1, false, 0, Math.PI), metal); edge.rotation.z = Math.PI / 2; edge.position.set(0, 0.62, 0.24); g.add(edge);
  } else if (kind === 'pick') {
    const head = new THREE.Mesh(geo.pickHead ||= new THREE.TorusGeometry(0.34, 0.05, 6, 14, Math.PI * 0.85), metal);
    head.rotation.set(0, Math.PI / 2, Math.PI * 0.075); head.position.set(0, 0.4, 0); g.add(head);
  } else {
    haft.scale.y = 0.55; haft.position.y = 0.18;
    const blade = new THREE.Mesh(geo.sickle ||= new THREE.TorusGeometry(0.2, 0.03, 5, 16, Math.PI * 1.15), metal);
    blade.rotation.set(0, Math.PI / 2, -0.4); blade.position.set(0, 0.5, 0.17); g.add(blade);
  }
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return g;
}

const G = {
  // the best tool in the bag for a node kind ({ kind, tier, id }) or null
  bestTool(nodeKind) {
    const kind = TOOL_FOR_NODE[nodeKind]; let best = -1;
    for (const b of this.S.bag) { const it = ITEMS[b.id]; if (it?.type === 'tool' && it.tool === kind && it.tier > best) best = it.tier; }
    return best < 0 ? null : { kind, tier: best, id: toolId(kind, best) };
  },
  // why a node cannot be gathered with your tools ('' when it can)
  toolProblem(e) {
    const kind = TOOL_FOR_NODE[e.nkind], K = TOOL_KINDS[kind], t = this.bestTool(e.nkind);
    if (!t) return `You need ${K.name === 'Axe' ? 'an' : 'a'} ${K.name} to gather ${e.name}. Gorm forges tools and Hilda sells them.`;
    if (t.tier < e.tier) return `Your ${ITEMS[t.id].name} is too weak for ${e.name}: you need a ${TOOL_TIERS[e.tier]} ${K.name} or better (Gorm forges it).`;
    return '';
  },
  // tool in hand, weapon put away, and the swing loop running
  startGatherAnim(e, tool) {
    this.stopGatherAnim();
    const p = this.player, P = p.humanoid.userData.parts, anim = TOOL_KINDS[tool.kind].anim;
    // step in to swinging distance
    const d = Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z), want = REACH[e.nkind] || 1.6;
    for (let r = want; r < d - 0.15; r += 0.15) { // the closest free spot on the way in (the walk grid has 2 m cells)
      const x = e.pos.x + (p.pos.x - e.pos.x) * (r / d), z = e.pos.z + (p.pos.z - e.pos.z) * (r / d);
      if (!this.map.isBlocked(x, z)) { p.pos.set(x, this.map.heightAt(x, z), z); break; }
    }
    const hidden = [];
    for (const hand of [P.handR, P.handL]) for (const c of hand.children.slice(1)) if (c.visible) { c.visible = false; hidden.push(c); }
    const model = toolModel(tool.kind, tool.tier);
    model.rotation.x = anim === 'harvest' ? Math.PI / 2 - 0.2 : anim === 'mine' ? Math.PI / 2 + 0.55 : Math.PI / 2 + 0.25;
    P.handR.add(model);
    this.gathering = { e, tool, anim, model, hidden, hit: false };
    p.state = anim; p.actT = p.actDur = SWING[anim];
  },
  stopGatherAnim() {
    const G2 = this.gathering; if (!G2) return;
    G2.model.parent?.remove(G2.model);
    for (const c of G2.hidden) c.visible = true;
    this.gathering = null;
    const p = this.player; if (p.state === G2.anim) { p.state = 'idle'; p.actT = 0; }
  },
  // every frame: keep swinging, land the hits, settle shaking nodes
  gatherTick(dt) {
    const G2 = this.gathering, p = this.player;
    if (G2) {
      if (p.state !== G2.anim || p.actT <= 0.001) { p.state = G2.anim; p.actT = p.actDur = SWING[G2.anim]; G2.hit = false; }
      if (!G2.hit && 1 - p.actT / p.actDur >= IMPACT[G2.anim]) { G2.hit = true; this.gatherImpact(G2); }
      p.yawT = Math.atan2(G2.e.pos.x - p.pos.x, G2.e.pos.z - p.pos.z);
    }
    if (!this.shaking?.size) return;
    for (const e of this.shaking) {
      e.shake = Math.max(0, e.shake - dt * 2.2);
      const k = e.shake * e.shake, w = Math.sin(this.time * 38) * k;
      if (e.nkind === 'tree') { e.model.rotation.z = w * 0.06; e.model.rotation.x = Math.cos(this.time * 31) * k * 0.03; }
      else if (e.nkind === 'ore') { e.model.rotation.z = w * 0.035; e.model.scale.set(1 + k * 0.03, 1 - k * 0.04, 1 + k * 0.03); }
      else { e.model.rotation.z = w * 0.12; e.model.scale.set(1, 1 - k * 0.12, 1); }
      if (e.shake <= 0) { e.model.rotation.z = 0; e.model.rotation.x = 0; e.model.scale.set(1, 1, 1); this.shaking.delete(e); }
    }
  },
  // the tool lands: the node shakes and throws chips, sparks or leaves
  gatherImpact(G2) {
    const e = G2.e, p = this.player, fx = this.fx;
    (this.shaking ||= new Set()).add(e); e.shake = 1;
    const toward = new THREE.Vector3(p.pos.x - e.pos.x, 0, p.pos.z - e.pos.z).normalize();
    const at = (h) => e.pos.clone().addScaledVector(toward, 0.45).setY(e.pos.y + h);
    if (e.nkind === 'tree') {
      fx.emit(at(0.9), { count: 14, colors: [0xc8955a, 0x8a5a2a, 0xe8c890], speed: 4, life: 0.7, size: 0.3, up: 3, gravity: -12, jitter: 0.3 });
      fx.emit(e.pos.clone().setY(e.pos.y + e.height * 0.8), { count: 10, colors: [0x5ac84a, 0x8ae05a, 0x3a9a3a], speed: 1.5, life: 1.6, size: 0.35, up: 0.5, gravity: -2.5, jitter: 1.8 });
      this.sfx.play('chop');
    } else if (e.nkind === 'ore') {
      fx.emit(at(0.55), { count: 16, colors: [0xffe07a, 0xffffff, 0xffa83a], speed: 7, life: 0.35, size: 0.22, up: 2, gravity: -14 });
      fx.emit(at(0.5), { count: 10, colors: [0x9a9aa8, 0x6a6a78, new THREE.Color(TOOL_METAL[e.tier]).getHex()], speed: 3.5, life: 0.7, size: 0.32, up: 3, gravity: -14, jitter: 0.25 });
      this.sfx.play('mine');
    } else {
      fx.emit(at(0.35), { count: 16, colors: [0x7ae05a, 0x4ab83a, 0xd8f0a0], speed: 2.5, life: 0.9, size: 0.3, up: 2.5, gravity: -5, jitter: 0.5 });
      this.sfx.play('rustle');
    }
  },
  // starter tools for every hero (waits for a free bag slot if the bag is full)
  grantStarterTools() {
    const S = this.S;
    if (S.toolsGiven) return;
    const missing = STARTER_TOOLS.filter((id) => !S.bag.some((b) => ITEMS[b.id]?.type === 'tool' && ITEMS[b.id].tool === ITEMS[id].tool));
    if (S.bag.length + missing.length > this.bagMax()) return;
    for (const id of missing) S.bag.push({ id, qty: 1 });
    S.toolsGiven = true;
    if (missing.length) this.ui.chat('system', 'You now carry a <b>Copper Axe</b>, <b>Copper Pickaxe</b> and <b>Copper Sickle</b>: trees need an axe, ore a pickaxe and herbs a sickle. Gorm forges better tools for higher-tier nodes.');
  },
  // Gorm forges a tool from the previous tier, ore and logs
  smithTool(rid) {
    const S = this.S, r = TOOL_RECIPES.find((x) => x.id === rid); if (!r) return;
    if (this.profLv('smithing') < r.lv) { this.ui.toast(`Requires Smithing Lv ${r.lv}`, 'warn'); return; }
    if (r.from && !this.countItem(r.from)) { this.ui.toast(`Bring your ${ITEMS[r.from].name}: it is reforged into the new tool`, 'warn'); this.sfx.play('error'); return; }
    const cost = { gold: r.gold, mats: r.mats };
    if (!this.canAfford(cost)) { this.ui.toast(this.missingText(cost), 'warn'); this.sfx.play('error'); return; }
    if (!r.from && !this.countItem(r.tool) && S.bag.length >= this.bagMax()) { this.ui.toast('Bag is full!', 'warn'); return; }
    this.pay(cost);
    if (r.from) this.removeItem(r.from, 1);
    this.addItem(r.tool, 1);
    this.addProfExp('smithing', r.exp); this.gainMastery('survival', 4);
    S.life.forged++; this.track('craft');
    this.sfx.play('level'); this.fx.buff(this.player, TOOL_METAL[ITEMS[r.tool].tier]);
    this.ui.toast(`Forged a ${ITEMS[r.tool].name}!`, 'good');
    this.ui.refreshPanel(); this.save();
  },
};
export function installGather(Game) { Object.assign(Game.prototype, G); }
