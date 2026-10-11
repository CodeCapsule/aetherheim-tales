// Instanced dungeon environments: themed rooms + corridors, rune seals between chambers, boss arena, nav grid and minimap.
import * as THREE from 'three';
import { NavGrid } from './nav.js';
import { toon, glow, outlineMaterial, getGradient, glowTexture, magicCircleTexture, stoneTexture } from './toon.js';

const THEMES = {
  grotto: {
    floor: 0x6a7a52, floorTint: '#5a6a44', wall: [0x6a6a58, 0x5a6448, 0x7a7a62], top: 0x5a9a3a, accent: 0x6af0ff, accent2: 0x9affc8, barrier: '#6af0ff',
    ambience: { background: 0x0b1a1c, fog: [40, 140, 0x0b1a1c], hemi: [0xa8f0ff, 0x2a3a2a, 1.35], ambient: 0.55, sun: [0xd0f4ff, 1.55] },
    map: { floor: '#5f7a5a', wall: '#2a3a30' },
  },
  crypt: {
    floor: 0x9a94b0, floorTint: '#6a6480', wall: [0x7a748a, 0x6a6478, 0x868098], top: 0x8a849a, accent: 0xffa040, accent2: 0xb07aff, barrier: '#c07aff',
    ambience: { background: 0x100c1a, fog: [40, 140, 0x100c1a], hemi: [0xd8c8ff, 0x2a2030, 1.25], ambient: 0.5, sun: [0xe8d8ff, 1.5] },
    map: { floor: '#6a6488', wall: '#2a2438' },
  },
  roots: {
    floor: 0x6a5038, floorTint: '#4a3628', wall: [0x6a4632, 0x5a3a2a, 0x7a5236], top: 0x4a7a3a, accent: 0xff4ad8, accent2: 0x7affb0, barrier: '#ff5ad8',
    ambience: { background: 0x140a18, fog: [40, 140, 0x140a18], hemi: [0xf0b8ff, 0x2a1a20, 1.3], ambient: 0.5, sun: [0xffd8f0, 1.5] },
    map: { floor: '#6a5040', wall: '#2a1a24' },
  },
  // high-level dungeons reuse the three layout styles with their own palettes and lighting
  hive: {
    style: 'grotto', floor: 0xd8a848, floorTint: '#c8983a', wall: [0xe8b84a, 0xd8a03a, 0xf0c860], top: 0xffe08a, accent: 0xffd84a, accent2: 0xff9a3a, barrier: '#ffd84a', pool: 0xffc030, circle: '#ffb03a', mote: 0xffe8a0, portal: '#ffc83a',
    ambience: { background: 0x2a1a08, fog: [40, 140, 0x2a1a08], hemi: [0xfff0c0, 0x5a3a10, 1.4], ambient: 0.6, sun: [0xffe8b0, 1.6] }, map: { floor: '#c8983a', wall: '#4a3010' },
  },
  marsh: {
    style: 'roots', floor: 0x4a6a44, floorTint: '#3a5a34', wall: [0x4a5a3a, 0x3a4a30, 0x5a6a44], top: 0x5a8a3a, accent: 0x7aff9a, accent2: 0x4ae8c8, barrier: '#7aff9a', circle: '#7aff9a', mote: 0xb8ff8a, portal: '#4ae8c8',
    ambience: { background: 0x0a1a12, fog: [36, 130, 0x0a1a12], hemi: [0xc8ffd8, 0x1a2a1a, 1.3], ambient: 0.5, sun: [0xd8ffe0, 1.4] }, map: { floor: '#4a6a44', wall: '#1a2a1a' },
  },
  ember: {
    style: 'grotto', floor: 0x5a3a2a, floorTint: '#4a2a1a', wall: [0x6a3a2a, 0x5a2a20, 0x7a4a30], top: 0xff6a2a, accent: 0xff7a2a, accent2: 0xffd04a, barrier: '#ff7a2a', pool: 0xff6a1a, circle: '#ff7a2a', mote: 0xffa040, portal: '#ff6a2a',
    ambience: { background: 0x1a0804, fog: [36, 130, 0x1a0804], hemi: [0xffc8a0, 0x3a1008, 1.35], ambient: 0.55, sun: [0xffd8b0, 1.6] }, map: { floor: '#6a3a2a', wall: '#2a0e08' },
  },
  frost: {
    style: 'crypt', floor: 0xd8e8f4, floorTint: '#b8d0e8', wall: [0xb8d0e8, 0xa8c0d8, 0xc8dcf0], top: 0xffffff, accent: 0x9ae8ff, accent2: 0x7ab8ff, barrier: '#9ae8ff', circle: '#9ae8ff', mote: 0xffffff, portal: '#9ae8ff',
    ambience: { background: 0x0c1828, fog: [40, 140, 0x0c1828], hemi: [0xe8f8ff, 0x2a3a4a, 1.4], ambient: 0.6, sun: [0xf0f8ff, 1.6] }, map: { floor: '#a8c8e0', wall: '#1a2a3a' },
  },
  crystal: {
    style: 'grotto', floor: 0x5a4a8a, floorTint: '#4a3a7a', wall: [0x6a5a9a, 0x5a4a8a, 0x7a6aaa], top: 0xc89aff, accent: 0xc89aff, accent2: 0x9ae8ff, barrier: '#c89aff', pool: 0xc8a8ff, circle: '#9ae8ff', mote: 0xd8b8ff, portal: '#c89aff',
    ambience: { background: 0x120a24, fog: [40, 140, 0x120a24], hemi: [0xe8d8ff, 0x2a1a40, 1.4], ambient: 0.55, sun: [0xf0e8ff, 1.6] }, map: { floor: '#6a5a9a', wall: '#1a1030' },
  },
  shadow: {
    style: 'crypt', floor: 0x3a3448, floorTint: '#2a2438', wall: [0x3a3448, 0x2a2438, 0x4a4458], top: 0x5a5468, accent: 0x7aff9a, accent2: 0xb07aff, barrier: '#7aff9a', circle: '#7aff9a', mote: 0x9aff9a, portal: '#7aff9a',
    ambience: { background: 0x06040c, fog: [34, 120, 0x06040c], hemi: [0xc8b8ff, 0x100818, 1.2], ambient: 0.45, sun: [0xd8c8ff, 1.4] }, map: { floor: '#3a3448', wall: '#0a0814' },
  },
  astral: {
    style: 'crypt', floor: 0xe8e4f8, floorTint: '#d0c8f0', wall: [0xd8d4f0, 0xc8c4e0, 0xf0ecff], top: 0xffffff, accent: 0xffd84a, accent2: 0x9ad8ff, barrier: '#ffd84a', circle: '#ffd84a', mote: 0xfff2b8, portal: '#ffd84a',
    ambience: { background: 0x0a0c2a, fog: [50, 160, 0x0a0c2a], hemi: [0xf8f4ff, 0x2a2a5a, 1.5], ambient: 0.65, sun: [0xfff8e8, 1.7] }, map: { floor: '#c8c0e8', wall: '#14163a' },
  },
  sacred: {
    style: 'roots', floor: 0x7a6a44, floorTint: '#6a5a34', wall: [0x8a6448, 0x7a5438, 0x9a7458], top: 0x7ad87a, accent: 0x7aff7a, accent2: 0xffd84a, barrier: '#ffd84a', circle: '#ffd84a', mote: 0xfff08a, portal: '#7aff7a',
    ambience: { background: 0x0c1a0c, fog: [40, 150, 0x0c1a0c], hemi: [0xfff8c8, 0x2a3a1a, 1.45], ambient: 0.6, sun: [0xfff4c8, 1.7] }, map: { floor: '#7a6a44', wall: '#1a2a10' },
  },
  // guild-war battleground: sunlit stone colosseum, blue (south, yours) vs red (north, theirs)
  arena: {
    floor: 0xcfc4ae, floorTint: '#b8ab92', wall: [0xb0a48c, 0xa09478, 0xbcb098], top: 0x7aa84a, accent: 0x6ad8ff, accent2: 0xff6a6a, barrier: '#ffd84a',
    ambience: { background: 0x6a9ad8, fog: [70, 200, 0x9ac0e8], hemi: [0xf0f6ff, 0x6a5a40, 1.5], ambient: 0.62, sun: [0xfff2d8, 1.8] },
    map: { floor: '#a89c84', wall: '#4a4232' },
  },
};

// ---------------------------------------------------------------- helpers
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
class Batch {
  constructor() { this.parts = []; }
  add(geo, color, m) { this.parts.push([geo, new THREE.Color(color), m]); }
  build() {
    if (!this.parts.length) return null;
    let nv = 0, ni = 0;
    for (const [g] of this.parts) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
    const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let vo = 0, io = 0; const v = new THREE.Vector3(), nm = new THREE.Matrix3();
    for (const [g, c, m] of this.parts) {
      const p = g.attributes.position, n = g.attributes.normal; nm.getNormalMatrix(m);
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(m); pos[(vo + i) * 3] = v.x; pos[(vo + i) * 3 + 1] = v.y; pos[(vo + i) * 3 + 2] = v.z;
        v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); nor[(vo + i) * 3] = v.x; nor[(vo + i) * 3 + 1] = v.y; nor[(vo + i) * 3 + 2] = v.z;
        col[(vo + i) * 3] = c.r; col[(vo + i) * 3 + 1] = c.g; col[(vo + i) * 3 + 2] = c.b;
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.array[i] + vo;
      else for (let i = 0; i < p.count; i++) idx[io + i] = i + vo;
      vo += p.count; io += g.index ? g.index.count : p.count;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeBoundingSphere();
    return geo;
  }
}
const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1), sph: new THREE.SphereGeometry(1, 10, 8), cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6), cone: new THREE.ConeGeometry(1, 1, 8), dode: new THREE.DodecahedronGeometry(1, 0),
  oct: new THREE.OctahedronGeometry(1, 0), torus: new THREE.TorusGeometry(1, 0.14, 8, 28),
};
const _q = new THREE.Quaternion(), _e = new THREE.Euler();
function M(x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
  _e.set(rx, ry, rz); _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(sx, sy, sz));
}
function canvasTex(w, h, draw, repeat = false) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function blotchTexture(base, seed) {
  const rng = mulberry(seed);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const x = rng() * w, y = rng() * h, r = 8 + rng() * 26;
      g.fillStyle = `rgba(${rng() < 0.5 ? '40,40,30' : '255,255,240'},${0.05 + rng() * 0.09})`;
      g.beginPath(); g.ellipse(x, y, r, r * (0.5 + rng() * 0.5), rng() * 3, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = 'rgba(30,25,20,0.25)'; g.lineWidth = 2;
    for (let i = 0; i < 14; i++) { let x = rng() * w, y = rng() * h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rng() - 0.5) * 40; y += (rng() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
  }, true);
}
function runeTexture(color) {
  return canvasTex(256, 160, (g, w, h) => {
    const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0.05)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 4; g.shadowColor = color; g.shadowBlur = 10;
    for (let i = 0; i < 6; i++) { const x = 20 + i * 43; g.beginPath(); g.moveTo(x, h); g.lineTo(x, 12); g.stroke(); }
    g.font = 'bold 30px serif'; g.textAlign = 'center'; g.fillStyle = '#ffffff';
    const runes = 'ᚠᚱᚲᚷᚹᚾᛁᛃᛇᛉᛊᛏ';
    for (let i = 0; i < 5; i++) g.fillText(runes[(i * 5) % runes.length], 41 + i * 43, 70 + (i % 2) * 34);
    g.strokeRect(4, 4, w - 8, h - 8);
  });
}
function swirlTexture(color) {
  return canvasTex(256, 256, (g, w, h) => {
    g.translate(w / 2, h / 2);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 128); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.3, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 128, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 5;
    for (let k = 0; k < 4; k++) { g.beginPath(); for (let a = 0; a < 9; a += 0.1) { const r = a * 13; g.lineTo(Math.cos(a + k * Math.PI / 2) * r, Math.sin(a + k * Math.PI / 2) * r); } g.stroke(); }
  });
}

// ---------------------------------------------------------------- dungeon
export class Dungeon {
  constructor(scene, def) {
    this.scene = scene; this.def = def; this.isDungeon = true;
    this.theme = THEMES[def.theme] || THEMES.grotto;
    this.style = this.theme.style || (THEMES[def.theme] ? def.theme : 'grotto');
    this.ambience = this.theme.ambience;
    this.disposables = []; this.anim = []; this.motes = [];
  }

  track(x) { this.disposables.push(x); return x; }

  build() {
    const def = this.def, O = def.origin, T = this.theme;
    this.root = new THREE.Group(); this.root.name = 'dungeon-' + def.id; this.scene.add(this.root);
    // rooms & corridors (world coords)
    this.rooms = def.rooms.map((r, i) => {
      const x = O.x + r.x, z = O.z + r.z;
      const room = { index: i, x, z, w: r.w, d: r.d, minX: x - r.w / 2, maxX: x + r.w / 2, minZ: z - r.d / 2, maxZ: z + r.d / 2, def: r };
      room.spawnPoints = (n) => this.spawnPoints(room, n);
      return room;
    });
    this.rects = this.rooms.map((r) => ({ minX: r.minX, maxX: r.maxX, minZ: r.minZ, maxZ: r.maxZ, room: r.index }));
    this.corridors = [];
    for (let i = 0; i < this.rooms.length - 1; i++) {
      const a = this.rooms[i], b = this.rooms[i + 1], W = 4;
      const segs = [];
      if (Math.abs(a.x - b.x) < 0.01) segs.push({ minX: a.x - W, maxX: a.x + W, minZ: b.maxZ - 1, maxZ: a.minZ + 1 });
      else {
        const mid = (a.minZ + b.maxZ) / 2;
        segs.push({ minX: a.x - W, maxX: a.x + W, minZ: mid - W, maxZ: a.minZ + 1 });
        segs.push({ minX: Math.min(a.x, b.x) - W, maxX: Math.max(a.x, b.x) + W, minZ: mid - W, maxZ: mid + W });
        segs.push({ minX: b.x - W, maxX: b.x + W, minZ: b.maxZ - 1, maxZ: mid + W });
      }
      for (const s of segs) { s.room = -1; this.rects.push(s); }
      this.corridors.push(segs);
    }
    const bx0 = Math.min(...this.rects.map((r) => r.minX)) - 14, bx1 = Math.max(...this.rects.map((r) => r.maxX)) + 14;
    const bz0 = Math.min(...this.rects.map((r) => r.minZ)) - 14, bz1 = Math.max(...this.rects.map((r) => r.maxZ)) + 14;
    this.bounds = { minX: bx0, maxX: bx1, minZ: bz0, maxZ: bz1 };
    this.nav = new NavGrid(bx0, bz0, bx1 - bx0, bz1 - bz0, 2, 1);
    const inside = (x, z, m = 0) => this.rects.some((r) => x > r.minX + m && x < r.maxX - m && z > r.minZ + m && z < r.maxZ - m);
    for (let cz = 0; cz < this.nav.nz; cz++) for (let cx = 0; cx < this.nav.nx; cx++) {
      const [x, z] = this.nav.center(cx, cz);
      if (inside(x, z, 0.9)) this.nav.setCell(cx, cz, 0);
    }
    this.inside = inside;
    const last = this.rooms[this.rooms.length - 1];
    const cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
    this.zone = { name: def.name, lv: def.arena ? 'Guild War' : `Lv ${def.lv}+ Dungeon`, safe: false, x: cx, z: cz, r: Math.max(bx1 - bx0, bz1 - bz0) };
    const r0 = this.rooms[0];
    this.start = { x: r0.x, z: r0.maxZ - 7, yaw: Math.PI };
    this.chestPos = { x: last.x, z: last.z };
    this.exitPos = { x: last.x, z: last.minZ + 6 };

    this.toonBatch = new Batch(); this.glowBatch = new Batch();
    this.buildFloors();
    this.buildWalls();
    this.buildDecor();
    this.buildBossRoom();
    this.buildBarriers();
    if (def.arena) this.buildArenaBases();
    this.finishBatches();
    this.buildMotes();
    this.buildMinimap();
    return this;
  }

  // ------------------------------------------------------------ queries
  heightAt() { return 0; }
  isBlocked(x, z) { return this.nav.isBlocked(x, z); }
  lineClear(ax, az, bx, bz) { return this.nav.lineClear(ax, az, bx, bz); }
  nearestFree(x, z) { return this.nav.nearestFree(x, z); }
  findPath(sx, sz, tx, tz) { return this.nav.findPath(sx, sz, tx, tz); }
  zoneAt() { return this.zone; }
  roomAt(x, z) { const r = this.rooms.find((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ); return r ? r.index : -1; }
  spawnPoints(room, n) {
    const rng = Math.random, out = [];
    for (let tries = 0; out.length < n && tries < 400; tries++) {
      const x = room.minX + 3 + rng() * (room.w - 6), z = room.minZ + 3 + rng() * (room.d - 6);
      if (this.isBlocked(x, z)) continue;
      if (room.index === 0 && Math.hypot(x - this.start.x, z - this.start.z) < 9) continue;
      if (out.some((p) => Math.hypot(p.x - x, p.z - z) < (tries < 250 ? 3.2 : 1.5))) continue;
      out.push({ x, z });
    }
    while (out.length < n) out.push({ x: room.x, z: room.z });
    return out;
  }

  // ------------------------------------------------------------ build steps
  buildFloors() {
    const T = this.theme;
    let tex;
    if (this.style === 'crypt' || this.style === 'arena') { tex = stoneTexture().clone(); tex.needsUpdate = true; }
    else tex = blotchTexture(T.floorTint, this.def.id.charCodeAt(1) * 31);
    this.track(tex);
    const mat = this.track(new THREE.MeshToonMaterial({ color: T.floor, map: tex, gradientMap: getGradient() }));
    for (const r of this.rects) {
      const w = r.maxX - r.minX, d = r.maxZ - r.minZ;
      const g = this.track(new THREE.BoxGeometry(w, 0.4, d));
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 8, uv.getY(i) * d / 8);
      const m = new THREE.Mesh(g, mat); m.position.set((r.minX + r.maxX) / 2, -0.2, (r.minZ + r.maxZ) / 2); m.receiveShadow = true;
      this.root.add(m);
    }
    const B = this.bounds;
    const under = new THREE.Mesh(this.track(new THREE.PlaneGeometry(B.maxX - B.minX + 80, B.maxZ - B.minZ + 80)), this.track(new THREE.MeshBasicMaterial({ color: this.ambience.background })));
    under.rotation.x = -Math.PI / 2; under.position.set((B.minX + B.maxX) / 2, -0.5, (B.minZ + B.maxZ) / 2); this.root.add(under);
  }

  buildWalls() {
    const T = this.theme, nav = this.nav, rng = mulberry(this.def.id.charCodeAt(1) * 977);
    const free = (cx, cz) => nav.inside(cx, cz) && nav.grid[cz * nav.nx + cx] === 0;
    let n = 0;
    for (let cz = 0; cz < nav.nz; cz++) for (let cx = 0; cx < nav.nx; cx++) {
      if (free(cx, cz)) continue;
      let edge = false;
      for (let dz = -1; dz <= 1 && !edge; dz++) for (let dx = -1; dx <= 1; dx++) if ((dx || dz) && free(cx + dx, cz + dz)) { edge = true; break; }
      if (!edge) continue;
      const [x, z] = nav.center(cx, cz);
      n++;
      const col = T.wall[(rng() * T.wall.length) | 0];
      // walls on the camera (south) side of a floor stay low so they never hide the hero
      const low = free(cx, cz - 1) && !free(cx, cz + 1);
      if (low) {
        if (this.style === 'arena') { this.toonBatch.add(GEO.box, col, M(x, 0.6, z, 2.05, 1.2, 2.05)); this.toonBatch.add(GEO.box, 0x8a7e66, M(x, 1.3, z, 2.2, 0.25, 2.2)); }
        else if (this.style === 'crypt') { this.toonBatch.add(GEO.box, col, M(x, 0.8, z, 2.05, 1.6, 2.05)); this.toonBatch.add(GEO.box, 0x5a546a, M(x, 1.7, z, 2.2, 0.3, 2.2)); }
        else if (this.style === 'roots') this.toonBatch.add(GEO.cyl, col, M(x, 0.7, z, 1.1, 1.8, 1.1, Math.PI / 2, rng() * 3, 0));
        else this.toonBatch.add(GEO.dode, col, M(x, 0.6, z, 1.6, 1.1, 1.6, rng() * 3, rng() * 3, rng() * 3));
        continue;
      }
      if (this.style === 'arena') {
        const h = 4.2;
        this.toonBatch.add(GEO.box, col, M(x, h / 2, z, 2.05, h, 2.05));
        if (n % 2) this.toonBatch.add(GEO.box, 0x9a8e76, M(x, h + 0.45, z, 1.3, 0.9, 1.3));
        if (n % 9 === 0) {
          const mid = (this.bounds.minZ + this.bounds.maxZ) / 2;
          this.glowBatch.add(GEO.box, z > mid ? T.accent : T.accent2, M(x, 2.6, z, 2.12, 1.8, 2.12));
        }
        continue;
      }
      if (this.style === 'grotto') {
        const h = 4 + rng() * 4, s = 1.5 + rng() * 0.9;
        this.toonBatch.add(GEO.dode, col, M(x, h * 0.42, z, s, h * 0.55, s, rng() * 3, rng() * 3, rng() * 3));
        if (rng() < 0.35) this.toonBatch.add(GEO.sph, T.top, M(x, h * 0.85, z, s * 0.9, 0.4, s * 0.9));
        if (rng() < 0.12) this.addCrystal(x + (rng() - 0.5), 0.2, z + (rng() - 0.5), rng() < 0.5 ? T.accent : T.accent2, 0.5 + rng() * 0.5);
        if (rng() < 0.1) this.toonBatch.add(GEO.cone, col, M(x, h + 1.2, z, 0.8, 3, 0.8));
      } else if (this.style === 'crypt') {
        const h = 6 + (n % 7 === 0 ? 1.4 : 0);
        this.toonBatch.add(GEO.box, col, M(x, h / 2, z, 2.05, h, 2.05));
        this.toonBatch.add(GEO.box, 0x5a546a, M(x, h + 0.2, z, 2.2, 0.4, 2.2));
        if (n % 7 === 0) this.glowBatch.add(GEO.box, T.accent2, M(x, 3.2, z, 2.1, 0.22, 2.1));
        if (n % 11 === 0) this.addTorch(x, z);
      } else {
        const h = 6 + rng() * 4, r = 1.0 + rng() * 0.7;
        this.toonBatch.add(GEO.cyl, col, M(x, h / 2 - 0.3, z, r, h, r, (rng() - 0.5) * 0.35, rng() * 3, (rng() - 0.5) * 0.35));
        if (rng() < 0.25) this.toonBatch.add(GEO.cyl, T.wall[0], M(x, h * 0.6, z, 0.5, 4.5, 0.5, Math.PI / 2 * (rng() < 0.5 ? 1 : 0), rng() * 3, Math.PI / 2 - 0.3));
        if (rng() < 0.25) this.toonBatch.add(GEO.sph, T.top, M(x, h - 0.2, z, 1.2, 0.5, 1.2));
        if (rng() < 0.12) this.addCrystal(x, 0.2, z, rng() < 0.6 ? T.accent : T.accent2, 0.6 + rng() * 0.6);
      }
    }
  }

  addCrystal(x, y, z, color, s = 1) {
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1;
      this.glowBatch.add(GEO.oct, color, M(x + Math.cos(a) * 0.35 * s, y + 0.6 * s, z + Math.sin(a) * 0.35 * s, 0.32 * s, (1.1 + i * 0.25) * s, 0.32 * s, Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3));
    }
    const h = new THREE.Sprite(this.track(new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 })));
    h.position.set(x, y + 0.9 * s, z); h.scale.setScalar(3 * s); this.root.add(h);
    const ph = Math.random() * 6;
    this.anim.push((t) => { h.material.opacity = 0.4 + Math.sin(t * 2 + ph) * 0.15; });
  }
  addTorch(x, z) {
    // place the flame on the face of the wall that looks into the room
    const [cx, cz] = this.nav.cellOf(x, z);
    let fx = 0, fz = 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.nav.inside(cx + dx, cz + dz) && this.nav.grid[(cz + dz) * this.nav.nx + cx + dx] === 0) { fx = dx; fz = dz; break; }
    const px = x + fx * 1.2, pz = z + fz * 1.2;
    this.toonBatch.add(GEO.box, 0x3a2a20, M(px, 3.4, pz, 0.3, 0.9, 0.3));
    this.glowBatch.add(GEO.cone, 0xffc060, M(px, 4.1, pz, 0.22, 0.6, 0.22));
    const s = new THREE.Sprite(this.track(new THREE.SpriteMaterial({ map: glowTexture(), color: this.theme.accent, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 })));
    s.position.set(px, 4.1, pz); s.scale.setScalar(2.6); this.root.add(s);
    const ph = Math.random() * 6;
    this.anim.push((t) => { const f = 1 + Math.sin(t * 13 + ph) * 0.08 + Math.sin(t * 7.3 + ph) * 0.06; s.scale.setScalar(2.6 * f); });
  }

  buildDecor() {
    const T = this.theme, rng = mulberry(this.def.id.charCodeAt(1) * 131);
    const mouths = [];
    this.rooms.forEach((r, i) => { if (i < this.rooms.length - 1) mouths.push({ x: r.x, z: r.minZ }); if (i > 0) mouths.push({ x: r.x, z: r.maxZ }); });
    mouths.push({ x: this.start.x, z: this.start.z });
    for (const r of this.rooms.slice(0, -1)) {
      const count = Math.round((r.w + r.d) / 7);
      for (let k = 0, placed = 0; k < 60 && placed < count; k++) {
        const side = (rng() * 4) | 0, t = rng();
        let x = side < 2 ? r.minX + 2.6 + t * (r.w - 5.2) : (side === 2 ? r.minX + 2.6 : r.maxX - 2.6);
        let z = side >= 2 ? r.minZ + 2.6 + t * (r.d - 5.2) : (side === 0 ? r.minZ + 2.6 : r.maxZ - 2.6);
        if (mouths.some((m) => Math.hypot(m.x - x, m.z - z) < 7) || this.isBlocked(x, z)) continue;
        placed++;
        this.decorPiece(x, z, rng, r);
      }
      if (this.style === 'grotto' && rng() < 0.9) this.addPool(r.x + (rng() - 0.5) * r.w * 0.3, r.z + (rng() - 0.5) * r.d * 0.3, 1.6 + rng() * 1.2);
      if (this.style === 'crypt') this.addFloorCircle(r.x, r.z, 3.2, this.theme.circle || '#b07aff', 0.35);
    }
  }
  decorPiece(x, z, rng, room) {
    const T = this.theme;
    if (this.style === 'grotto') {
      if (rng() < 0.55) {
        for (let i = 0; i < 3; i++) {
          const ox = x + (rng() - 0.5) * 1.6, oz = z + (rng() - 0.5) * 1.6, s = 0.5 + rng() * 0.6;
          this.toonBatch.add(GEO.cyl6, 0xe8e0c8, M(ox, s * 0.5, oz, 0.12 * s, s, 0.12 * s));
          this.glowBatch.add(GEO.sph, rng() < 0.5 ? T.accent : T.accent2, M(ox, s, oz, 0.45 * s, 0.25 * s, 0.45 * s));
        }
        this.nav.blockCircle(x, z, 0.6);
      } else { this.addCrystal(x, 0, z, rng() < 0.5 ? T.accent : T.accent2, 0.9 + rng() * 0.5); this.nav.blockCircle(x, z, 0.7); }
    } else if (this.style === 'crypt') {
      const r = rng();
      if (r < 0.4) {
        const rot = Math.abs(x - room.minX) < 3 || Math.abs(x - room.maxX) < 3 ? 0 : Math.PI / 2;
        this.toonBatch.add(GEO.box, 0x8a8498, M(x, 0.6, z, 1.6, 1.2, 3.2, 0, rot, 0));
        this.toonBatch.add(GEO.box, 0x9a94a8, M(x, 1.35, z, 1.8, 0.3, 3.4, 0, rot, 0));
        this.glowBatch.add(GEO.box, T.accent2, M(x, 1.52, z, 0.2, 0.05, 2.0, 0, rot, 0));
        this.nav.blockRect(x, z, rot ? 3.2 : 1.6, rot ? 1.6 : 3.2, 0);
      } else if (r < 0.75) {
        this.toonBatch.add(GEO.cyl, 0x8a8498, M(x, 2.6, z, 0.7, 5.2, 0.7));
        this.toonBatch.add(GEO.box, 0x9a94a8, M(x, 5.3, z, 1.8, 0.4, 1.8));
        this.toonBatch.add(GEO.box, 0x9a94a8, M(x, 0.25, z, 1.8, 0.5, 1.8));
        this.nav.blockCircle(x, z, 0.8);
      } else {
        for (let i = 0; i < 3; i++) { const ox = x + (rng() - 0.5), oz = z + (rng() - 0.5); this.toonBatch.add(GEO.cyl6, 0xf0e8d0, M(ox, 0.3, oz, 0.1, 0.6, 0.1)); this.glowBatch.add(GEO.cone, 0xffc060, M(ox, 0.72, oz, 0.07, 0.2, 0.07)); }
        this.toonBatch.add(GEO.sph, 0xe8e0c8, M(x + 0.6, 0.3, z, 0.35, 0.3, 0.3));
      }
    } else {
      if (rng() < 0.5) {
        const rot = rng() * Math.PI;
        this.toonBatch.add(GEO.cyl, T.wall[1], M(x, 0.45, z, 0.55, 4.5, 0.55, 0, rot, Math.PI / 2));
        this.nav.blockRect(x, z, 4.5, 1.2, rot);
      } else { this.addCrystal(x, 0, z, rng() < 0.65 ? T.accent : T.accent2, 1 + rng() * 0.6); this.nav.blockCircle(x, z, 0.8); }
      if (rng() < 0.5) this.glowBatch.add(GEO.sph, T.accent2, M(x + 1, 0.4, z + 0.6, 0.35, 0.22, 0.35));
    }
  }
  addPool(x, z, r) {
    const m = new THREE.Mesh(this.track(new THREE.CircleGeometry(r, 28)), this.track(new THREE.MeshBasicMaterial({ color: this.theme.pool ?? 0x4ae8ff, transparent: true, opacity: 0.55, depthWrite: false })));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.03, z); this.root.add(m);
    this.toonBatch.add(GEO.torus, 0x7a7a62, M(x, 0.05, z, r, r, 1.6, Math.PI / 2, 0, 0));
    this.anim.push((t) => { m.material.opacity = 0.45 + Math.sin(t * 1.7 + x) * 0.1; });
  }
  addFloorCircle(x, z, r, color, opacity = 0.6) {
    const m = new THREE.Mesh(this.track(new THREE.CircleGeometry(r, 40)), this.track(new THREE.MeshBasicMaterial({ map: magicCircleTexture(color), transparent: true, depthWrite: false, opacity, blending: THREE.AdditiveBlending })));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.04, z); this.root.add(m);
    this.anim.push((t) => { m.rotation.z = t * 0.2; });
    return m;
  }

  buildBossRoom() {
    const T = this.theme, r = this.rooms[this.rooms.length - 1];
    const circleColor = this.theme.circle || { grotto: '#ff8ad8', crypt: '#c07aff', roots: '#7affb0', arena: '#ffd84a' }[this.style];
    this.addFloorCircle(r.x, r.z, Math.min(r.w, r.d) * 0.32, circleColor, 0.75);
    const n = 8, rad = Math.min(r.w, r.d) * 0.42;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / 8, x = r.x + Math.cos(a) * rad, z = r.z + Math.sin(a) * rad;
      if (Math.hypot(x - r.x, z - r.maxZ) < 9 || Math.hypot(x - this.exitPos.x, z - this.exitPos.z) < 5) continue;
      if (this.style === 'arena') {
        this.toonBatch.add(GEO.cyl, 0xd8ccb4, M(x, 2.2, z, 0.8, 4.4, 0.8));
        this.toonBatch.add(GEO.box, 0xbcb098, M(x, 4.55, z, 1.9, 0.4, 1.9));
        this.toonBatch.add(GEO.box, 0xbcb098, M(x, 0.2, z, 1.9, 0.4, 1.9));
        this.glowBatch.add(GEO.oct, z > r.z ? T.accent : T.accent2, M(x, 5.4, z, 0.4, 0.7, 0.4));
        this.nav.blockCircle(x, z, 0.9);
      } else if (this.style === 'crypt') {
        this.toonBatch.add(GEO.cyl, 0x8a8498, M(x, 3.5, z, 0.9, 7, 0.9));
        this.toonBatch.add(GEO.box, 0x9a94a8, M(x, 7.2, z, 2.2, 0.5, 2.2));
        this.glowBatch.add(GEO.sph, T.accent2, M(x, 7.9, z, 0.45, 0.45, 0.45));
        this.nav.blockCircle(x, z, 1);
      } else {
        this.addCrystal(x, 0, z, i % 2 ? T.accent : T.accent2, 1.6);
        this.toonBatch.add(GEO.dode, T.wall[0], M(x, 0.4, z, 1.3, 0.7, 1.3));
        this.nav.blockCircle(x, z, 1.1);
      }
    }
    if (this.style === 'roots') {
      for (let i = 0; i < 5; i++) {
        const a = Math.PI * (1.15 + i * 0.17), x = r.x + Math.cos(a) * (rad + 6), z = r.z + Math.sin(a) * (rad + 6);
        this.toonBatch.add(GEO.cyl, T.wall[2], M(x, 6, z, 2.2, 14, 2.2, 0.25, 0, (r.x - x) * 0.02));
      }
    }
  }

  buildBarriers() {
    this.barriers = [];
    const tex = this.track(runeTexture(this.theme.barrier));
    const col = new THREE.Color(this.theme.barrier);
    for (let i = 0; i < this.rooms.length - 1; i++) {
      const r = this.rooms[i];
      const x = r.x, z = r.minZ;
      const g = new THREE.Group(); g.position.set(x, 0, z);
      const mat = this.track(new THREE.MeshBasicMaterial({ map: tex, color: col, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      const plane = new THREE.Mesh(this.track(new THREE.PlaneGeometry(8.4, 5)), mat); plane.position.y = 2.5; g.add(plane);
      for (const s of [-1, 1]) this.toonBatch.add(GEO.box, this.theme.wall[0], M(x + s * 4.6, 3, z, 1.2, 6, 1.4));
      this.root.add(g);
      const cells = [];
      const [c0x, c0z] = this.nav.cellOf(x - 4.6, z - 1.4), [c1x, c1z] = this.nav.cellOf(x + 4.6, z + 1.4);
      for (let cz = c0z; cz <= c1z; cz++) for (let cx = c0x; cx <= c1x; cx++) {
        if (!this.nav.inside(cx, cz) || this.nav.grid[cz * this.nav.nx + cx] !== 0) continue;
        this.nav.setCell(cx, cz, 1); cells.push([cx, cz]);
      }
      const b = { x, z, w: 8.4, rot: 0, open: false, mesh: g, mat, cells, openT: -1 };
      this.barriers.push(b);
      this.anim.push((t, dt) => {
        if (b.openT < 0) { mat.opacity = 0.7 + Math.sin(t * 3 + i) * 0.15; return; }
        b.openT += dt;
        const k = Math.min(1, b.openT);
        mat.opacity = 0.85 * (1 - k); plane.scale.y = 1 - k * 0.9; plane.position.y = 2.5 * (1 - k * 0.9);
        if (k >= 1) g.visible = false;
      });
    }
  }
  // team bases at both ends of the arena: rune dais, banners and braziers
  buildArenaBases() {
    const r = this.rooms[0], T = this.theme;
    const bases = [{ z: r.maxZ - 15, col: T.accent, hex: '#6ad8ff', banner: 0x2a6ad8 }, { z: r.minZ + 15, col: T.accent2, hex: '#ff6a6a', banner: 0xc83a3a }];
    for (const b of bases) {
      this.addFloorCircle(r.x, b.z, 7, b.hex, 0.7);
      this.toonBatch.add(GEO.cyl, 0xbcb098, M(r.x, 0.06, b.z, 7.4, 0.12, 7.4));
      for (const s of [-1, 1]) {
        const x = r.x + s * 10, z = b.z;
        this.toonBatch.add(GEO.cyl6, 0x7a5a3a, M(x, 3, z, 0.18, 6, 0.18));
        this.toonBatch.add(GEO.box, b.banner, M(x + s * 0.02, 4.2, z, 0.08, 3, 1.6));
        this.glowBatch.add(GEO.box, 0xffe07a, M(x + s * 0.06, 4.9, z, 0.06, 0.5, 0.6));
        this.toonBatch.add(GEO.cyl, 0x8a7e66, M(x, 0.5, z + 4, 0.7, 1, 0.7));
        this.glowBatch.add(GEO.cone, b.col, M(x, 1.4, z + 4, 0.45, 0.9, 0.45));
        this.nav.blockCircle(x, z, 0.5); this.nav.blockCircle(x, z + 4, 0.8);
      }
    }
  }

  openBarrier(i) {
    const b = this.barriers[i];
    if (!b || b.open) return;
    b.open = true; b.openT = 0;
    for (const [cx, cz] of b.cells) this.nav.setCell(cx, cz, 0);
    for (let k = 0; k < 40; k++) this.spawnMote(b.x + (Math.random() - 0.5) * 8, Math.random() * 4, b.z + (Math.random() - 0.5) * 1.5, this.theme.barrier, 1.4);
  }

  finishBatches() {
    const tg = this.toonBatch.build(), gg = this.glowBatch.build();
    if (tg) {
      this.track(tg);
      const mat = this.track(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: getGradient() }));
      const m = new THREE.Mesh(tg, mat); m.castShadow = true; m.receiveShadow = true; this.root.add(m);
      this.root.add(new THREE.Mesh(tg, outlineMaterial(0.05, 0x1a1218)));
    }
    if (gg) { this.track(gg); this.root.add(new THREE.Mesh(gg, this.track(new THREE.MeshBasicMaterial({ vertexColors: true })))); }
  }

  buildMotes() {
    const N = 140, B = this.bounds, rng = mulberry(7);
    const pos = new Float32Array(N * 3), seeds = [];
    for (let i = 0; i < N; i++) {
      let x, z, k = 0;
      do { x = B.minX + rng() * (B.maxX - B.minX); z = B.minZ + rng() * (B.maxZ - B.minZ); } while (!this.inside(x, z, 1) && ++k < 30);
      seeds.push([x, z, rng() * 10]);
    }
    const g = this.track(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const color = this.theme.mote ?? (this.style === 'roots' ? 0xd8ff8a : this.style === 'crypt' ? 0xc8a8ff : this.style === 'arena' ? 0xffe8a0 : 0x9af0ff);
    const pts = new THREE.Points(g, this.track(new THREE.PointsMaterial({ map: glowTexture(), color, size: 0.6, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    pts.frustumCulled = false; this.root.add(pts);
    this.anim.push((t) => {
      for (let i = 0; i < N; i++) { const [x, z, p] = seeds[i]; pos[i * 3] = x + Math.sin(t * 0.3 + p) * 1.5; pos[i * 3 + 1] = 0.6 + ((t * 0.35 + p) % 6); pos[i * 3 + 2] = z + Math.cos(t * 0.27 + p) * 1.5; }
      g.attributes.position.needsUpdate = true;
    });
  }
  spawnMote(x, y, z, color, life) {
    const s = new THREE.Sprite(this.track(new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false })));
    s.position.set(x, y, z); s.scale.setScalar(0.6 + Math.random() * 0.6); this.root.add(s);
    this.motes.push({ s, life, max: life, vy: 1 + Math.random() * 2 });
  }

  buildMinimap() {
    const B = this.bounds, size = Math.max(B.maxX - B.minX, B.maxZ - B.minZ);
    const minX = (B.minX + B.maxX) / 2 - size / 2, minZ = (B.minZ + B.maxZ) / 2 - size / 2;
    const S = 360, k = S / size;
    const c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    g.fillStyle = '#0c0f1c'; g.fillRect(0, 0, S, S);
    g.fillStyle = this.theme.map.wall;
    for (const r of this.rects) g.fillRect((r.minX - minX) * k - 3, (r.minZ - minZ) * k - 3, (r.maxX - r.minX) * k + 6, (r.maxZ - r.minZ) * k + 6);
    g.fillStyle = this.theme.map.floor;
    for (const r of this.rects) g.fillRect((r.minX - minX) * k, (r.minZ - minZ) * k, (r.maxX - r.minX) * k, (r.maxZ - r.minZ) * k);
    const last = this.rooms[this.rooms.length - 1];
    g.strokeStyle = 'rgba(255,120,200,0.8)'; g.lineWidth = 2; g.beginPath(); g.arc((last.x - minX) * k, (last.z - minZ) * k, Math.min(last.w, last.d) * 0.32 * k, 0, Math.PI * 2); g.stroke();
    this.minimap = { canvas: c, minX, minZ, size };
  }

  // ------------------------------------------------------------ props for the game
  buildChest() {
    const g = new THREE.Group();
    const wood = toon(0x9a5a2a), gold = toon(0xf0c040), dark = toon(0x5a3014);
    const add = (geo, mat, x, y, z, sx, sy, sz, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; const o = new THREE.Mesh(geo, outlineMaterial(Math.round(0.03 / Math.max(sx, sy, sz) * 1000) / 1000, 0x24160f)); m.add(o); parent.add(m); return m; };
    add(GEO.box, wood, 0, 0.45, 0, 1.6, 0.9, 1.05);
    for (const x of [-0.62, 0.62]) add(GEO.box, gold, x, 0.45, 0, 0.14, 0.94, 1.09);
    add(GEO.box, dark, 0, 0.06, 0, 1.66, 0.12, 1.1);
    const lid = new THREE.Group(); lid.position.set(0, 0.9, -0.52); g.add(lid);
    const half = new THREE.CylinderGeometry(0.53, 0.53, 1.6, 16, 1, false, 0, Math.PI); half.rotateZ(Math.PI / 2); half.rotateX(-Math.PI / 2);
    this.track(half);
    const lm = new THREE.Mesh(half, wood); lm.position.set(0, 0, 0.52); lm.add(new THREE.Mesh(half, outlineMaterial(0.03, 0x24160f))); lid.add(lm);
    for (const x of [-0.62, 0.62]) { const band = new THREE.Mesh(half, gold); band.scale.set(0.09, 1.04, 1.04); band.position.set(x, 0, 0.52); lid.add(band); }
    add(GEO.box, gold, 0, 0.72, 0.53, 0.3, 0.36, 0.08);
    const gem = new THREE.Mesh(GEO.oct, glow(0xff4a8a)); gem.scale.setScalar(0.1); gem.position.set(0, 0.74, 0.58); g.add(gem);
    const h = new THREE.Sprite(this.track(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffd84a, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 })));
    h.scale.setScalar(4.5); h.position.y = 0.8; g.add(h);
    g.userData.lid = lid;
    return g;
  }
  buildExitPortal() {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(GEO.torus, toon(0xd8c890)); ring.scale.setScalar(1.5); ring.position.y = 1.9;
    ring.add(new THREE.Mesh(GEO.torus, outlineMaterial(0.03, 0x24160f))); g.add(ring);
    const tex = this.track(swirlTexture('#6ad8ff'));
    const disc = new THREE.Mesh(this.track(new THREE.CircleGeometry(1.42, 40)), this.track(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })));
    disc.position.y = 1.9; g.add(disc);
    for (const s of [-1, 1]) { const st = new THREE.Mesh(GEO.dode, toon(0x8a8478)); st.scale.set(0.6, 0.5, 0.6); st.position.set(s * 1.5, 0.3, 0); g.add(st); }
    const h = new THREE.Sprite(this.track(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x6ad8ff, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 })));
    h.scale.setScalar(5); h.position.y = 1.9; g.add(h);
    g.userData.update = (t) => { disc.rotation.z = -t * 2.2; h.material.opacity = 0.6 + Math.sin(t * 3) * 0.2; };
    return g;
  }

  update(dt, t) {
    for (const f of this.anim) f(t, dt);
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i]; m.life -= dt;
      m.s.position.y += m.vy * dt; m.s.material.opacity = Math.max(0, m.life / m.max);
      if (m.life <= 0) { this.root.remove(m.s); this.motes.splice(i, 1); }
    }
  }

  dispose() {
    this.scene.remove(this.root);
    for (const d of this.disposables) d.dispose && d.dispose();
    this.disposables = []; this.anim = []; this.motes = [];
  }
}

// ---------------------------------------------------------------- overworld entrances
export function buildDungeonEntrance(theme) {
  const T = THEMES[theme] || THEMES.grotto, g = new THREE.Group();
  const portalColor = T.portal || { grotto: '#6af0ff', crypt: '#c07aff', roots: '#ff5ad8' }[theme] || '#6af0ff';
  const style = T.style || (THEMES[theme] ? theme : 'grotto');
  const add = (geo, color, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, toon(color)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); m.castShadow = true;
    m.add(new THREE.Mesh(geo, outlineMaterial(Math.round(0.06 / Math.max(sx, sy, sz) * 1000) / 1000, 0x24160f))); g.add(m); return m;
  };
  if (style === 'crypt') {
    for (const s of [-1, 1]) { add(GEO.box, T.wall[0], s * 3.4, 3.2, 0, 1.6, 6.4, 1.8); add(GEO.box, 0x9a94a8, s * 3.4, 6.6, 0, 2, 0.5, 2.2); }
    add(GEO.box, 0x7a748a, 0, 7.3, 0, 8.6, 1.2, 2.2);
    add(GEO.cone, 0x6a6478, 0, 8.6, 0, 1.2, 1.6, 1.2);
    add(GEO.box, 0x6a6478, 0, 3.2, -0.9, 5.2, 6.4, 0.4);
    for (let i = 0; i < 3; i++) add(GEO.box, 0x9a94a8, 0, 0.15 + i * 0.25, 1.6 - i * 0.6, 7 - i * 0.6, 0.3, 0.8);
  } else if (style === 'roots') {
    for (const s of [-1, 1]) {
      add(GEO.cyl, T.wall[0], s * 3.6, 3.5, 0, 1.1, 7.5, 1.1, 0, 0, s * 0.25);
      add(GEO.cyl, T.wall[1], s * 2.2, 7.3, 0, 0.8, 4.4, 0.8, 0, 0, s * 1.15);
      add(GEO.sph, T.top, s * 3.8, 7.3, 0, 1.6, 1.0, 1.6);
    }
    add(GEO.cyl, T.wall[2], 0, 0.5, -0.6, 0.6, 9, 0.6, 0, 0, Math.PI / 2);
    for (const s of [-1, 1]) { const c = new THREE.Mesh(GEO.oct, glow(T.accent ?? 0xff4ad8)); c.position.set(s * 4.8, 0.8, 0.8); c.scale.set(0.4, 1.1, 0.4); g.add(c); }
  } else {
    const rocks = [[-3.8, 1.6, 2.2, 2.2], [-4.2, 4, 1.8, 1.9], [-2.8, 6.3, 1.9, 1.6], [0, 7.4, 2.6, 1.5], [2.8, 6.3, 1.9, 1.6], [4.2, 4, 1.8, 1.9], [3.8, 1.6, 2.2, 2.2]];
    rocks.forEach(([x, y, s, sy], i) => add(GEO.dode, T.wall[i % 3], x, y, 0, s, sy, s * 0.9, i, i * 2, 0));
    add(GEO.sph, T.top, 0, 8.6, 0, 2.6, 0.7, 2);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      add(GEO.cyl6, 0xe8e0c8, s * (4.6 + i * 0.5), 0.35, 1.2 - i * 0.4, 0.12, 0.7, 0.12);
      const cap = new THREE.Mesh(GEO.sph, glow(i % 2 ? T.accent : T.accent2)); cap.position.set(s * (4.6 + i * 0.5), 0.75, 1.2 - i * 0.4); cap.scale.set(0.4, 0.22, 0.4); g.add(cap);
    }
  }
  const dark = new THREE.Mesh(new THREE.CircleGeometry(2.7, 32), new THREE.MeshBasicMaterial({ color: 0x0a0612 }));
  dark.scale.y = 1.25; dark.position.set(0, 3.2, -0.25); g.add(dark);
  const swirl = new THREE.Mesh(new THREE.CircleGeometry(2.5, 40), new THREE.MeshBasicMaterial({ map: swirlTexture(portalColor), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  swirl.scale.y = 1.25; swirl.position.set(0, 3.2, -0.1); g.add(swirl);
  const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(portalColor), blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 }));
  h.scale.setScalar(8); h.position.set(0, 3.2, 0.4); g.add(h);
  g.userData.update = (t) => { swirl.rotation.z = -t * 1.6; h.material.opacity = 0.55 + Math.sin(t * 2.4) * 0.15; };
  g.userData.radius = 4.6;
  return g;
}
