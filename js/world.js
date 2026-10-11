// The overworld of Carlyle: terrain, river, Sylvan Haven, ruins, sky, World Tree, collision grid and A* pathing.
import * as THREE from 'three';
import { NavGrid } from './nav.js';
import { DUNGEONS } from './data.js';
import { NEW_ZONES, FARM, OUTPOSTS } from './data-world.js';
import { buildDungeonEntrance } from './dungeon.js';
import { toon, glow, outlineMaterial, grassTexture, stoneTexture, cloudTexture, glowTexture, magicCircleTexture, getGradient } from './toon.js';

export const SIZE = 800, HALF = 400;
export const WATER_Y = -1.0;
const SEG = 400;
const CELL = 2, GN = SIZE / CELL;

const RIVER = [[110, -410], [124, -300], [112, -215], [88, -120], [72, -50], [70, 10], [85, 80], [118, 150], [150, 215], [162, 300], [150, 410]];
const ROADS = [
  [[0, 0], [60, 0], [100, 1], [158, 2]],
  [[0, 0], [0, 60], [2, 95], [-12, 124]],
  [[0, 0], [-60, 0], [-100, -12], [-128, -60], [-146, -92]],
  [[0, 0], [0, -60], [0, -150], [0, -250], [0, -350]],
  [[158, 2], [230, 8], [300, 10], [370, 14]],
  [[-12, 124], [8, 200], [24, 260], [36, 360]],
  [[-100, -12], [-180, 0], [-260, 8], [-370, 14]],
  [[230, 8], [250, -120], [266, -260]],
  [[230, 8], [255, 140], [270, 262]],
  [[-180, 0], [-228, 140], [-262, 262]],
  [[-180, 0], [-222, -140], [-256, -262]],
];
export const BRIDGES = [{ x: 70.5, z: 0.5, len: 26, w: 6, axis: 'x' }, { x: 102, z: 118, len: 24, w: 5, axis: 'x' }];
export const ARENA = { x: -150, z: -112, r: 21 };
export const ALTAR = { x: 128, z: -86, r: 13 }; // Storm Altar: world boss stage
export const OVERLOOK = { x: 0, z: -160 };
export const TELEPORT_CIRCLE = { x: 0, z: -46 };
export const WORLD_TREE = { x: 0, z: -760 };
const PLATFORMS = [{ x: 0, z: 0, r: 17.2, y: 0.3 }, { x: -150, z: -112, r: 21.5, y: 0.55 }, { x: 0, z: -160, r: 8, y: 1.95 }, { x: 0, z: -46, r: 4.6, y: 0.2 }, { x: ALTAR.x, z: ALTAR.z, r: ALTAR.r + 0.4, y: 0.5 }];
const nearAltar = (x, z, m = 6) => Math.hypot(x - ALTAR.x, z - ALTAR.z) < ALTAR.r + m;
const nearFarm = (x, z, m = 4) => Math.hypot(x - FARM.x, z - FARM.z) < FARM.r + m;
const nearOutpost = (x, z, m = 9) => OUTPOSTS.some((o) => Math.hypot(x - o.x, z - o.z) < m);
// Biome weight of a zone at a point (1 in the core, fading out at the rim) and the strongest biome there.
function biomeW(x, z, zn) { return 1 - smooth(zn.r * 0.55, zn.r * 1.05, Math.hypot(x - zn.x, z - zn.z)); }
export function biomeAt(x, z) {
  let best = null, bw = 0.35;
  for (const zn of NEW_ZONES) { const w = biomeW(x, z, zn); if (w > bw) { bw = w; best = zn.biome; } }
  return best;
}
function biomeHeight(b, x, z) {
  switch (b) {
    case 'plains': return fbm(x / 90, z / 90) * 4 - 1.2 + fbm(x / 25, z / 25) * 0.8;
    case 'marsh': return fbm(x / 30 + 7, z / 30 + 2) * 3.4 - 2.3;
    case 'ember': { const m = smooth(0.54, 0.6, fbm(x / 45 + 3, z / 45 + 9)); return fbm(x / 60, z / 60) * 5 - 1 + m * 8; }
    case 'frost': return fbm(x / 55 + 1, z / 55 + 4) * 12 - 2 + fbm(x / 18, z / 18) * 2;
    case 'crystal': return fbm(x / 50 + 6, z / 50 + 1) * 8 - 1.5;
    case 'shadow': return fbm(x / 35 + 2, z / 35 + 5) * 4.2 - 1.9;
    case 'astral': return fbm(x / 70 + 9, z / 70 + 7) * 5 + 1.5;
    default: return fbm(x / 60, z / 60) * 4 + 0.5;
  }
}

// ---------------------------------------------------------------- noise
function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < 4; i++) { s += a * vnoise(x * f, z * f); f *= 2; a *= 0.5; } return s; }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az; const l2 = dx * dx + dz * dz;
  let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}
function polyDist(px, pz, poly) { let d = 1e9; for (let i = 0; i < poly.length - 1; i++) d = Math.min(d, segDist(px, pz, poly[i][0], poly[i][1], poly[i + 1][0], poly[i + 1][1])); return d; }
export const riverDist = (x, z) => polyDist(x, z, RIVER);
export const roadDist = (x, z) => { let d = 1e9; for (const r of ROADS) d = Math.min(d, polyDist(x, z, r)); return d; };
function onBridge(x, z) {
  for (const b of BRIDGES) {
    if (Math.abs(z - b.z) < b.w / 2 && Math.abs(x - b.x) < b.len / 2) return b;
  }
  return null;
}
function bridgeDeckY(b, x) { const t = (x - (b.x - b.len / 2)) / b.len; return 0.35 + Math.sin(Math.PI * Math.max(0, Math.min(1, t))) * 1.4; }

function rawHeight0(x, z) {
  let h = fbm(x / 70 + 10, z / 70 + 3) * 7 - 2.2 + fbm(x / 20, z / 20) * 1.3;
  if (z > 60 && x < 80 && z < 200) h += fbm(x / 30 + 5, z / 30) * 3;
  for (const zn of NEW_ZONES) { const w = biomeW(x, z, zn); if (w > 0) h = lerp(h, biomeHeight(zn.biome, x, z), w); }
  const dT = Math.hypot(x, z);
  h = lerp(0, h, smooth(50, 78, dT));
  const rd = roadDist(x, z);
  h = lerp(h * 0.3, h, smooth(3, 10, rd));
  const da = Math.hypot(x - ARENA.x, z - ARENA.z);
  h = lerp(0.4, h, smooth(ARENA.r + 1, ARENA.r + 10, da));
  const dal = Math.hypot(x - ALTAR.x, z - ALTAR.z);
  h = lerp(0.3, h, smooth(ALTAR.r + 1, ALTAR.r + 10, dal));
  const dO = Math.hypot(x - OVERLOOK.x, z - OVERLOOK.z);
  h = lerp(1.5, h, smooth(14, 24, dO));
  const dF = Math.hypot(x - FARM.x, z - FARM.z);
  h = lerp(0.35, h, smooth(FARM.r + 2, FARM.r + 10, dF));
  for (const o of OUTPOSTS) { const d = Math.hypot(x - o.x, z - o.z); if (d < 16) h = lerp(Math.max(0.2, h * 0.4), h, smooth(7, 15, d)); }
  const rv = riverDist(x, z);
  if (rv < 14) { h = Math.max(h, -0.2); h = lerp(-2.9, h, smooth(5.5, 12, rv)); }
  const e = Math.max(Math.abs(x), Math.abs(z));
  if (e > 358) h += Math.pow((e - 358) / 42, 2) * 48 * (0.7 + 0.6 * fbm(x / 25, z / 25));
  return h;
}

const portalBase = new Map();
function rawHeight(x, z) {
  let h = rawHeight0(x, z);
  for (const d of DUNGEONS) {
    const p = d.portal, dp = Math.hypot(x - p.x, z - p.z);
    if (dp > 18) continue;
    if (!portalBase.has(d.id)) portalBase.set(d.id, rawHeight0(p.x, p.z));
    h = lerp(portalBase.get(d.id), h, smooth(9, 17, dp));
  }
  return h;
}

// ---------------------------------------------------------------- static batching
class Batch {
  constructor() { this.parts = []; }
  add(geo, color, matrix) { this.parts.push([geo, new THREE.Color(color), matrix]); }
  build() {
    if (!this.parts.length) return null;
    let nv = 0, ni = 0;
    for (const [g] of this.parts) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
    const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let vo = 0, io = 0;
    const v = new THREE.Vector3(), nm = new THREE.Matrix3();
    for (const [g, c, m] of this.parts) {
      const p = g.attributes.position, n = g.attributes.normal; nm.getNormalMatrix(m);
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(m); pos.set([v.x, v.y, v.z], (vo + i) * 3);
        v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); nor.set([v.x, v.y, v.z], (vo + i) * 3);
        col.set([c.r, c.g, c.b], (vo + i) * 3);
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
  box: new THREE.BoxGeometry(1, 1, 1),
  sph: new THREE.SphereGeometry(1, 12, 9),
  sphHi: new THREE.SphereGeometry(1, 18, 12),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cone: new THREE.ConeGeometry(1, 1, 12),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  roof: new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4),
  cone8: new THREE.ConeGeometry(1, 1, 8),
  hemi: new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  torus: new THREE.TorusGeometry(1, 0.12, 6, 18, Math.PI),
  dode: new THREE.DodecahedronGeometry(1, 0),
  oct: new THREE.OctahedronGeometry(1, 0),
};
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
function M(x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
  _e.set(rx, ry, rz); _q.setFromEuler(_e); _s.set(sx, sy, sz); _p.set(x, y, z);
  return new THREE.Matrix4().compose(_p, _q, _s);
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group(); this.root.name = 'overworld';
    scene.add(this.root);
    this.heights = new Float32Array((SEG + 1) * (SEG + 1));
    this.nav = new NavGrid(-HALF, -HALF, SIZE, SIZE, CELL);
    this.batches = new Map();
    this.anim = [];
    this.treeSpots = [];
    this.buildings = [];
    this.t = 0;
  }

  // -------------------------------------------------------------- queries
  heightAt(x, z) {
    const b = onBridge(x, z);
    const fx = (x + HALF) / SIZE * SEG, fz = (z + HALF) / SIZE * SEG;
    const ix = Math.max(0, Math.min(SEG - 1, Math.floor(fx))), iz = Math.max(0, Math.min(SEG - 1, Math.floor(fz)));
    const tx = Math.min(1, Math.max(0, fx - ix)), tz = Math.min(1, Math.max(0, fz - iz));
    const H = this.heights, W = SEG + 1;
    const h = lerp(lerp(H[iz * W + ix], H[iz * W + ix + 1], tx), lerp(H[(iz + 1) * W + ix], H[(iz + 1) * W + ix + 1], tx), tz);
    if (b) return Math.max(h, bridgeDeckY(b, x));
    for (const p of PLATFORMS) if (Math.hypot(x - p.x, z - p.z) < p.r) return Math.max(h, p.y);
    return h;
  }
  cellOf(x, z) { return this.nav.cellOf(x, z); }
  isBlocked(x, z) { return this.nav.isBlocked(x, z); }
  blockCircle(x, z, r) { this.nav.blockCircle(x, z, r); }
  blockRect(x, z, w, d, rot = 0) { this.nav.blockRect(x, z, w, d, rot); }
  lineClear(ax, az, bx, bz) { return this.nav.lineClear(ax, az, bx, bz); }
  nearestFree(x, z) { return this.nav.nearestFree(x, z); }
  findPath(sx, sz, tx, tz) { return this.nav.findPath(sx, sz, tx, tz); }
  zoneAt(x, z, zones) {
    let best = null, bd = 1e9;
    for (const zn of zones) { const d = Math.hypot(x - zn.x, z - zn.z) / zn.r; if (d < 1 && d < bd) { bd = d; best = zn; } }
    return best;
  }

  // -------------------------------------------------------------- build
  batch(x, z) {
    const key = Math.floor((x + HALF) / 80) + ',' + Math.floor((z + HALF) / 80);
    if (!this.batches.has(key)) this.batches.set(key, { toon: new Batch(), glow: new Batch() });
    return this.batches.get(key);
  }
  put(geo, color, x, y, z, sx, sy, sz, rx, ry, rz) { this.batch(x, z).toon.add(geo, color, M(x, y, z, sx, sy, sz, rx, ry, rz)); }
  putGlow(geo, color, x, y, z, sx, sy, sz, rx, ry, rz) { this.batch(x, z).glow.add(geo, color, M(x, y, z, sx, sy, sz, rx, ry, rz)); }
  // place a part relative to a rotated anchor
  putRel(ax, az, rot, geo, color, lx, y, lz, sx, sy, sz, rx = 0, ry = 0, rz = 0, isGlow = false) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const x = ax + lx * c + lz * s, z = az - lx * s + lz * c;
    (isGlow ? this.putGlow : this.put).call(this, geo, color, x, y, z, sx, sy, sz, rx, ry + rot, rz);
  }

  build(onProgress = () => {}) {
    this.buildTerrain(); onProgress(0.2);
    this.buildWater(); this.buildSky(); onProgress(0.3);
    this.buildTown(); this.buildDungeonGates(); onProgress(0.45);
    this.buildBridges(); this.buildRuins(); this.buildOverlook(); this.buildAltar(); this.buildFarm(); this.buildOutposts(); this.buildBiomeProps(); onProgress(0.55);
    this.buildTrees(); onProgress(0.7);
    this.buildGroundCover(); onProgress(0.8);
    this.buildBoundary(); this.buildWorldTree(); this.buildIslands(); onProgress(0.9);
    this.finishBatches();
    this.buildAmbient(); this.buildBiomeWeather();
    this.buildMinimap(); onProgress(1);
  }

  buildTerrain() {
    const W = SEG + 1;
    for (let iz = 0; iz <= SEG; iz++) for (let ix = 0; ix <= SEG; ix++) {
      const x = -HALF + ix / SEG * SIZE, z = -HALF + iz / SEG * SIZE;
      this.heights[iz * W + ix] = rawHeight(x, z);
    }
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color(), cA = new THREE.Color();
    const C = {
      grass: new THREE.Color('#7cc650'), meadow: new THREE.Color('#9ad85e'), forest: new THREE.Color('#4f9c40'),
      ruins: new THREE.Color('#a4b860'), dirt: new THREE.Color('#dcbc80'), sand: new THREE.Color('#ead9a0'),
      bed: new THREE.Color('#9ab0a0'), rock: new THREE.Color('#a39b90'), snow: new THREE.Color('#f4f8ff'), town: new THREE.Color('#86cc5a'),
      plains: new THREE.Color('#b8dc5a'), marsh: new THREE.Color('#6a8a4c'), ember: new THREE.Color('#c0663a'), emberTop: new THREE.Color('#8a4a34'),
      frost: new THREE.Color('#eaf4fc'), crystal: new THREE.Color('#9a90e0'), shadow: new THREE.Color('#5a4a72'), astral: new THREE.Color('#e4dcf6'), sacred: new THREE.Color('#9ae07a'), farm: new THREE.Color('#b0884a'),
    };
    const bc = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      // PlaneGeometry rotated: rows run along z
      const ix = Math.round((x + HALF) / SIZE * SEG), iz = Math.round((z + HALF) / SIZE * SEG);
      const h = this.heights[iz * W + ix];
      pos.setY(i, h);
      c.copy(C.grass);
      const meadowT = smooth(70, 100, x) * (1 - smooth(60, 100, z));
      c.lerp(C.meadow, meadowT);
      c.lerp(C.forest, smooth(60, 95, z) * (1 - smooth(70, 110, x)));
      c.lerp(C.ruins, smooth(-60, -95, x));
      c.lerp(C.town, 1 - smooth(40, 60, Math.hypot(x, z)));
      for (const zn of NEW_ZONES) {
        const w = biomeW(x, z, zn); if (w <= 0) continue;
        bc.copy(C[zn.biome]);
        if (zn.biome === 'ember' && h > 4) bc.lerp(C.emberTop, smooth(4, 7, h));
        if (zn.biome === 'marsh' && h < -0.6) bc.lerp(C.bed, 0.5);
        c.lerp(bc, w);
      }
      if (Math.hypot(x - FARM.x, z - FARM.z) < FARM.r) c.lerp(C.farm, 0.55);
      const n = fbm(x / 9, z / 9);
      c.multiplyScalar(0.86 + n * 0.28);
      const rd = roadDist(x, z);
      if (rd < 6) { cA.copy(C.dirt).multiplyScalar(0.92 + n * 0.16); c.lerp(cA, 1 - smooth(3, 6, rd)); }
      const rv = riverDist(x, z);
      if (rv < 12) c.lerp(C.sand, 1 - smooth(8, 12, rv));
      if (h < WATER_Y) c.copy(C.bed);
      const e = Math.max(Math.abs(x), Math.abs(z));
      if (e > 368) c.lerp(C.rock, smooth(368, 382, e));
      if (h > 26) c.lerp(C.snow, smooth(26, 34, h));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const gt = grassTexture(); gt.repeat.set(180, 180);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: gt });
    this.terrain = new THREE.Mesh(geo, mat);
    this.terrain.receiveShadow = true;
    this.root.add(this.terrain);

    // collision: water, mountains
    for (let cz = 0; cz < GN; cz++) for (let cx = 0; cx < GN; cx++) {
      const [x, z] = this.nav.center(cx, cz);
      const e = Math.max(Math.abs(x), Math.abs(z));
      let blocked = e > 376;
      if (!blocked && riverDist(x, z) < 7.2 && !onBridge(x, z)) blocked = true;
      if (!blocked && rawHeight(x, z) < WATER_Y - 0.25 && riverDist(x, z) > 7.2 && roadDist(x, z) > 3) blocked = true;
      if (blocked) this.nav.setCell(cx, cz, 1);
    }
  }

  buildWater() {
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]);
    const mat = new THREE.ShaderMaterial({
      uniforms, transparent: true, fog: true, depthWrite: false,
      vertexShader: [
        'varying vec3 vW;',
        '#include <fog_pars_vertex>',
        'void main() {',
        '  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;',
        '  vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;',
        '  #include <fog_vertex>',
        '}'].join('\n'),
      fragmentShader: [
        'uniform float uTime; varying vec3 vW;',
        '#include <common>',
        '#include <fog_pars_fragment>',
        'void main() {',
        '  float w = sin(vW.x*0.35+uTime*1.1)*0.5 + sin(vW.z*0.42-uTime*0.9)*0.5;',
        '  float c = sin(vW.x*1.3+uTime*1.6+sin(vW.z*0.9+uTime*0.8)*2.0)*sin(vW.z*1.1-uTime*1.2+sin(vW.x*0.7)*2.0);',
        '  vec3 col = mix(vec3(0.20,0.58,0.86), vec3(0.42,0.82,0.96), w*0.5+0.5);',
        '  col += smoothstep(0.55,0.95,c)*vec3(0.5,0.6,0.6);',
        '  gl_FragColor = vec4(col, 0.84);',
        '  #include <fog_fragment>',
        '}'].join('\n'),
    });
    const geo = new THREE.PlaneGeometry(SIZE + 200, SIZE + 200, 1, 1); geo.rotateX(-Math.PI / 2);
    this.water = new THREE.Mesh(geo, mat); this.water.position.y = WATER_Y; this.water.renderOrder = -1;
    this.root.add(this.water);
  }

  buildSky() {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color('#2f86e0') }, mid: { value: new THREE.Color('#8fd0ff') }, bot: { value: new THREE.Color('#e8f8ff') } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h*1.6,0.0,1.0),0.8)) : mix(mid, bot, clamp(-h*4.0,0.0,1.0)); gl_FragColor = vec4(c,1.0); }',
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), mat);
    this.root.add(this.sky);
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff6c8, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    sun.position.set(500, 700, 400); sun.scale.setScalar(320); this.root.add(sun);
    // clouds
    this.clouds = [];
    const ct = cloudTexture();
    for (let i = 0; i < 70; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, transparent: true, depthWrite: false, fog: false, opacity: 0.92 }));
      const a = Math.random() * Math.PI * 2, r = 120 + Math.random() * 1000;
      s.position.set(Math.cos(a) * r, 120 + Math.random() * 110, Math.sin(a) * r);
      const sc = 70 + Math.random() * 90; s.scale.set(sc * 2, sc, 1);
      this.root.add(s); this.clouds.push(s);
    }
  }

  // ---------------------------------------------------------- town
  house(x, z, rot, { w = 8, d = 7, h = 4.5, roof = 0xd8504a, wall = 0xfff1d6, tower = false } = {}) {
    const y = this.heightAt(x, z) - 0.2;
    const R = (geo, col, lx, ly, lz, sx, sy, sz, rx, ry, rz, gl) => this.putRel(x, z, rot, geo, col, lx, y + ly, lz, sx, sy, sz, rx, ry, rz, gl);
    const beam = 0x6a4430;
    if (tower) {
      R(GEO.cyl, wall, 0, h / 2, 0, w / 2, h, w / 2);
      R(GEO.cone, roof, 0, h + h * 0.45, 0, w / 2 + 0.8, h * 0.9, w / 2 + 0.8);
      R(GEO.box, beam, 0, 1.2, w / 2 - 0.05, 1.4, 2.4, 0.3);
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; R(GEO.box, 0xffe08a, Math.sin(a) * (w / 2), h * 0.65, Math.cos(a) * (w / 2), 0.8, 1.1, 0.2, 0, a, 0, true); }
      R(GEO.cyl6, beam, 0, h * 1.95, 0, 0.08, 1.6, 0.08);
      R(GEO.box, roof, 0.55, h * 2.2, 0, 1.0, 0.6, 0.05);
      this.blockCircle(x, z, w / 2);
      this.buildings.push({ x, z, w, d: w, rot });
      return;
    }
    R(GEO.box, wall, 0, h / 2, 0, w, h, d);
    R(GEO.box, 0xb89a7a, 0, 0.3, 0, w + 0.3, 0.6, d + 0.3);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) R(GEO.box, beam, sx * w / 2, h / 2, sz * d / 2, 0.35, h, 0.35);
    R(GEO.box, beam, 0, h - 0.15, d / 2, w, 0.3, 0.2); R(GEO.box, beam, 0, h - 0.15, -d / 2, w, 0.3, 0.2);
    R(GEO.box, beam, 0, h * 0.5, d / 2 + 0.02, w, 0.22, 0.15);
    R(GEO.roof, roof, 0, h + h * 0.42, 0, w * 0.86, h * 0.85, d * 0.86);
    R(GEO.box, 0x7a4a30, 0, 1.15, d / 2 + 0.05, 1.3, 2.3, 0.2);
    R(GEO.sph, 0xffd84a, 0.4, 1.15, d / 2 + 0.2, 0.08, 0.08, 0.08);
    for (const sx of [-1, 1]) {
      R(GEO.box, 0xffe08a, sx * w * 0.3, h * 0.62, d / 2 + 0.03, 1.0, 1.0, 0.12, 0, 0, 0, true);
      R(GEO.box, beam, sx * w * 0.3, h * 0.62, d / 2 + 0.08, 1.2, 0.12, 0.1);
      R(GEO.box, 0x8a5a3a, sx * w * 0.3, h * 0.62 - 0.65, d / 2 + 0.25, 1.2, 0.3, 0.4);
      for (let k = -1; k <= 1; k++) R(GEO.sph, [0xff6a8a, 0xffd84a, 0xc87aff][k + 1], sx * w * 0.3 + k * 0.35, h * 0.62 - 0.45, d / 2 + 0.3, 0.2, 0.2, 0.2);
      R(GEO.box, 0xffe08a, sx * w / 2 + sx * 0.03, h * 0.62, 0, 0.12, 1.0, 1.0, 0, 0, 0, true);
    }
    R(GEO.box, 0x9a8a80, w * 0.25, h + h * 0.6, -d * 0.15, 0.8, h * 0.7, 0.8);
    this.blockRect(x, z, w, d, rot);
    this.buildings.push({ x, z, w, d, rot });
  }

  mushroomHouse(x, z, rot, cap = 0xe04a3a) {
    const y = this.heightAt(x, z) - 0.2;
    const R = (geo, col, lx, ly, lz, sx, sy, sz, rx, ry, rz, gl) => this.putRel(x, z, rot, geo, col, lx, y + ly, lz, sx, sy, sz, rx, ry, rz, gl);
    R(GEO.cyl, 0xfff0d8, 0, 2.5, 0, 3, 5, 3);
    R(GEO.hemi, cap, 0, 4.6, 0, 5.4, 3.6, 5.4);
    R(GEO.cyl, 0xf8e0c0, 0, 4.62, 0, 5.3, 0.15, 5.3);
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, r = i % 2 ? 2.6 : 4.1; R(GEO.sph, 0xffffff, Math.cos(a) * r, 4.6 + 3.6 * Math.sqrt(1 - (r / 5.4) ** 2), Math.sin(a) * r, 0.75, 0.32, 0.75); }
    R(GEO.sph, 0xffffff, 0, 8.2, 0, 0.9, 0.3, 0.9);
    R(GEO.box, 0x7a4a30, 0, 1.1, 2.95, 1.2, 2.2, 0.2);
    R(GEO.box, 0xffe08a, 1.9, 3.0, 2.4, 0.8, 0.8, 0.12, 0, 0.6, 0, true);
    R(GEO.box, 0xffe08a, -1.9, 3.0, 2.4, 0.8, 0.8, 0.12, 0, -0.6, 0, true);
    this.blockCircle(x, z, 3.2);
    this.buildings.push({ x, z, w: 6, d: 6, rot });
  }

  lamp(x, z) {
    const y = this.heightAt(x, z);
    this.put(GEO.cyl6, 0x3a3440, x, y + 1.6, z, 0.1, 3.2, 0.1);
    this.put(GEO.box, 0x3a3440, x, y + 3.25, z, 0.55, 0.12, 0.55);
    this.putGlow(GEO.box, 0xffd27a, x, y + 3.65, z, 0.4, 0.6, 0.4);
    this.put(GEO.cone4, 0x3a3440, x, y + 4.15, z, 0.45, 0.45, 0.45, 0, Math.PI / 4, 0);
    this.blockCircle(x, z, 0.3);
    this.lampGlows.push([x, y + 3.65, z]);
  }

  fence(ax, az, bx, bz, color = 0x9a6a40) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(d / 2.5)), rot = Math.atan2(bx - ax, bz - az);
    for (let i = 0; i <= n; i++) {
      const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n, y = this.heightAt(x, z);
      this.put(GEO.box, color, x, y + 0.6, z, 0.22, 1.2, 0.22);
      if (i < n) {
        const mx = x + (bx - ax) / n / 2, mz = z + (bz - az) / n / 2, my = this.heightAt(mx, mz);
        this.put(GEO.box, color, mx, my + 0.85, mz, 0.12, 0.16, d / n, 0, rot, 0);
        this.put(GEO.box, color, mx, my + 0.45, mz, 0.12, 0.16, d / n, 0, rot, 0);
      }
    }
  }

  gate(x, z, rot) {
    const y = this.heightAt(x, z);
    const R = (geo, col, lx, ly, lz, sx, sy, sz, rx = 0, ry = 0, rz = 0, gl) => this.putRel(x, z, rot, geo, col, lx, y + ly, lz, sx, sy, sz, rx, ry, rz, gl);
    for (const s of [-1, 1]) {
      R(GEO.box, 0xd8d0c0, s * 5, 3, 0, 1.4, 6, 1.4);
      R(GEO.box, 0xb8b0a0, s * 5, 6.2, 0, 1.8, 0.4, 1.8);
      R(GEO.cone4, 0x3a6ad8, s * 5, 7.4, 0, 1.3, 2.0, 1.3, 0, Math.PI / 4, 0);
      R(GEO.box, 0x3a6ad8, s * 5, 3.6, 0.75, 1.0, 2.2, 0.05);
      R(GEO.sph, 0xf0c040, s * 5, 4.4, 0.8, 0.25, 0.25, 0.08);
      this.blockCircle(x + Math.cos(rot) * s * 5, z - Math.sin(rot) * s * 5, 0.9);
    }
    R(GEO.torus, 0xd8d0c0, 0, 6.2, 0, 5, 3.2, 4);
    R(GEO.box, 0x7a4a30, 0, 7.2, 0.3, 4.4, 1.1, 0.2);
  }

  buildTown() {
    this.lampGlows = [];
    // plaza
    const stoneTex = stoneTexture(); stoneTex.repeat.set(6, 6);
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(17, 17.5, 0.5, 48), new THREE.MeshToonMaterial({ color: 0xffffff, map: stoneTex, gradientMap: getGradient() }));
    plaza.position.y = 0.05; plaza.receiveShadow = true; this.root.add(plaza);
    const ringM = new THREE.Mesh(new THREE.TorusGeometry(17.3, 0.35, 6, 64), toon(0xb8a890)); ringM.rotation.x = Math.PI / 2; ringM.position.y = 0.3; this.root.add(ringM);
    // fountain
    this.put(GEO.cyl, 0xd8d0c4, 0, 0.6, 0, 5, 0.9, 5);
    this.put(GEO.cyl, 0xc4bcb0, 0, 1.6, 0, 1.0, 2.2, 1.0);
    this.put(GEO.cyl, 0xd8d0c4, 0, 2.8, 0, 2.2, 0.35, 2.2);
    this.put(GEO.cyl, 0xc4bcb0, 0, 3.6, 0, 0.5, 1.4, 0.5);
    this.blockCircle(0, 0, 5.2);
    const fw = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.1, 40), new THREE.MeshBasicMaterial({ color: 0x6fd0ff, transparent: true, opacity: 0.85 }));
    fw.position.y = 1.12; this.root.add(fw);
    const fw2 = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.1, 30), fw.material); fw2.position.y = 3.04; this.root.add(fw2);
    // spirit crystal atop fountain
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), new THREE.MeshToonMaterial({ color: 0x9af0ff, emissive: 0x2a6a8a, gradientMap: getGradient() }));
    crystal.position.y = 5.6; crystal.scale.y = 1.6; this.root.add(crystal);
    const ch = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x9af0ff, blending: THREE.AdditiveBlending, depthWrite: false }));
    ch.scale.setScalar(5); ch.position.y = 5.6; this.root.add(ch);
    this.anim.push((t) => { crystal.rotation.y = t * 0.8; crystal.position.y = 5.6 + Math.sin(t * 1.5) * 0.25; ch.position.y = crystal.position.y; });
    this.fountain = { x: 0, y: 3.8, z: 0 };
    // four spirit shrines around the plaza
    const shrines = [[0xff6a3a, 'Fire'], [0x4fb8ff, 'Water'], [0x5cf0a6, 'Wind'], [0xe0b040, 'Earth']];
    shrines.forEach(([col], i) => {
      const a = Math.PI / 4 + i * Math.PI / 2, x = Math.cos(a) * 12.5, z = Math.sin(a) * 12.5;
      this.put(GEO.cyl6, 0xd8d0c4, x, 0.9, z, 0.8, 1.8, 0.8);
      this.put(GEO.cyl6, 0xb8b0a4, x, 1.9, z, 1.0, 0.25, 1.0);
      const g = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), glow(col)); g.position.set(x, 2.7, z); g.scale.y = 1.5; this.root.add(g);
      const hs = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: col, blending: THREE.AdditiveBlending, depthWrite: false })); hs.scale.setScalar(2.6); hs.position.copy(g.position); this.root.add(hs);
      this.anim.push((t) => { g.rotation.y = t * 1.2 + i; g.position.y = 2.7 + Math.sin(t * 2 + i) * 0.15; hs.position.y = g.position.y; });
      this.blockCircle(x, z, 0.9);
    });

    // buildings
    this.house(-15, -29, 0, { w: 10, d: 7, h: 5, roof: 0x4aa05a });       // elder
    this.house(28, -20, -0.5, { w: 7, d: 6, h: 4.2, roof: 0xff7aa8 });     // pet house
    this.house(-30, -32, 0.3, { w: 7, d: 6, roof: 0x4a7ad8 });
    this.house(-40, 28, 2.2, { w: 8, d: 6, roof: 0xe8903a });
    this.house(22, 40, Math.PI, { w: 8, d: 7, roof: 0x3ab0a0 });
    this.house(-44, -4, Math.PI / 2, { w: 8, d: 7, h: 4.6, roof: 0x8a5a4a }); // blacksmith
    this.house(44, -16, 0, { w: 6.5, h: 7, roof: 0x3a6ad8, tower: true });   // guard tower
    this.house(-44, -22, 0, { w: 5.5, h: 8, roof: 0x9a5ad8, tower: true });
    this.mushroomHouse(32, -38, 0.4, 0x9a5ad8);
    this.mushroomHouse(-14, 42, 3.0, 0xe04a3a);
    this.mushroomHouse(42, 30, -1.2, 0xf08a3a);
    // stable pen
    this.house(38, 22, -Math.PI / 2, { w: 8, d: 6, h: 4, roof: 0xb83a3a, wall: 0xe8d0b0 });
    this.fence(26, 12, 26, 28); this.fence(26, 28, 32, 28);
    for (const [hx, hz] of [[29, 14], [29.5, 17]]) { const y = this.heightAt(hx, hz); this.put(GEO.cyl, 0xf0d060, hx, y + 0.5, hz, 0.8, 1.0, 0.8, Math.PI / 2, 0.3, 0); this.blockCircle(hx, hz, 0.8); }
    // market stalls
    const stalls = [[-27, 12, 1.8, 0xe84a5a], [-30, 20, 2.3, 0x4a8ae8], [-24, 24, 2.8, 0xf0b030]];
    for (const [sx, sz, r, col] of stalls) {
      const y = this.heightAt(sx, sz);
      const R = (geo, c, lx, ly, lz, a, b, cc, rx = 0, ry = 0, rz = 0) => this.putRel(sx, sz, r, geo, c, lx, y + ly, lz, a, b, cc, rx, ry, rz);
      for (const a of [-1, 1]) for (const b of [-1, 1]) R(GEO.box, 0x8a5a3a, a * 1.6, 1.4, b * 1.0, 0.18, 2.8, 0.18);
      R(GEO.box, 0xa87a50, 0, 1.0, 0, 3.4, 0.2, 2.2);
      for (let k = 0; k < 6; k++) R(GEO.box, k % 2 ? 0xffffff : col, -1.55 + k * 0.62, 3.0, 0, 0.62, 0.15, 2.8, 0.25, 0, 0);
      for (let k = 0; k < 5; k++) R(GEO.sph, [0xff4a3a, 0xffd84a, 0x7ad84a, 0xff9a3a, 0xc07aff][k], -1.2 + k * 0.6, 1.3, 0.3, 0.25, 0.25, 0.25);
      R(GEO.box, 0xb88a5a, 1.0, 1.4, -0.4, 0.7, 0.6, 0.7);
      this.blockRect(sx, sz, 3.4, 2.2, r);
    }
    // forge
    { const y = this.heightAt(-34, -8); this.put(GEO.box, 0x6a6470, -34, y + 1, -8, 2.4, 2, 2.4); this.putGlow(GEO.box, 0xff7a2a, -34, y + 1.2, -6.75, 1.2, 0.8, 0.1); this.put(GEO.box, 0x5a5560, -31.5, y + 0.5, -10, 1.0, 1.0, 0.6); this.put(GEO.box, 0x5a5560, -31.5, y + 1.05, -10, 1.4, 0.25, 0.7); this.blockRect(-34, -8, 2.4, 2.4); this.blockCircle(-31.5, -10, 0.8); }
    // teleport circle
    const tc = new THREE.Mesh(new THREE.CircleGeometry(4.2, 48), new THREE.MeshBasicMaterial({ map: magicCircleTexture('#7ad8ff'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    tc.rotation.x = -Math.PI / 2; tc.position.set(TELEPORT_CIRCLE.x, 0.26, TELEPORT_CIRCLE.z); this.root.add(tc);
    this.anim.push((t) => { tc.rotation.z = t * 0.4; });
    this.put(GEO.cyl, 0xd8d0c4, TELEPORT_CIRCLE.x, 0.1, TELEPORT_CIRCLE.z, 4.6, 0.2, 4.6);
    // gates
    this.gate(56, 0.5, Math.PI / 2); this.gate(0.5, 56, 0); this.gate(-56, 0, Math.PI / 2); this.gate(0, -56, 0);
    // perimeter fence (skip gaps at roads)
    const R0 = 60, segs = 48;
    for (let i = 0; i < segs; i++) {
      const a0 = i / segs * Math.PI * 2, a1 = (i + 1) / segs * Math.PI * 2;
      const mx = Math.cos((a0 + a1) / 2) * R0, mz = Math.sin((a0 + a1) / 2) * R0;
      if (roadDist(mx, mz) < 8 || riverDist(mx, mz) < 12) continue;
      this.fence(Math.cos(a0) * R0, Math.sin(a0) * R0, Math.cos(a1) * R0, Math.sin(a1) * R0, 0xa87a50);
    }
    // lamps along roads
    for (let d = 20; d <= 52; d += 11) for (const s of [-1, 1]) { this.lamp(d, s * 4.5); this.lamp(-d, s * 4.5); this.lamp(s * 4.5, d); this.lamp(s * 4.5, -d); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.2; if (Math.abs(Math.sin(a * 2)) > 0.2) this.lamp(Math.cos(a) * 19.5, Math.sin(a) * 19.5); }
    // flower beds and barrels
    const beds = [[-8, 22], [12, -24], [-22, -14], [18, 26], [-10, -40], [14, -44]];
    for (const [bx, bz] of beds) {
      const y = this.heightAt(bx, bz);
      this.put(GEO.cyl, 0x9a7a5a, bx, y + 0.3, bz, 2.0, 0.6, 2.0);
      this.put(GEO.cyl, 0x5a3a2a, bx, y + 0.62, bz, 1.8, 0.05, 1.8);
      for (let k = 0; k < 9; k++) { const a = k * 2.4, r = 0.4 + (k % 3) * 0.45; this.put(GEO.sph, [0xff6a8a, 0xffd84a, 0xffffff, 0xc87aff][k % 4], bx + Math.cos(a) * r, y + 0.9, bz + Math.sin(a) * r, 0.28, 0.24, 0.28); }
      this.blockCircle(bx, bz, 1.8);
    }
    const barrels = [[-20, 4], [-22, 5.5], [25, -6], [36, 8], [-38, -12], [10, 34], [-35, 36]];
    for (const [bx, bz] of barrels) { const y = this.heightAt(bx, bz); this.put(GEO.cyl, 0x9a6a40, bx, y + 0.6, bz, 0.6, 1.2, 0.6); this.put(GEO.cyl, 0x5a5a60, bx, y + 0.95, bz, 0.62, 0.08, 0.62); this.put(GEO.cyl, 0x5a5a60, bx, y + 0.3, bz, 0.62, 0.08, 0.62); this.blockCircle(bx, bz, 0.6); }
    // banners on poles around plaza
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2, x = Math.cos(a) * 23, z = Math.sin(a) * 23;
      if (roadDist(x, z) < 5) continue;
      this.put(GEO.cyl6, 0x6a4430, x, 3, z, 0.1, 6, 0.1);
      this.put(GEO.box, [0xe84a5a, 0x4a8ae8, 0xf0b030][i % 3], x, 4.4, z, 0.05, 2.4, 1.2, 0, a, 0);
      this.blockCircle(x, z, 0.3);
    }
  }

  buildBridges() {
    for (const b of BRIDGES) {
      const n = 22;
      for (let i = 0; i <= n; i++) {
        const x = b.x - b.len / 2 + i / n * b.len, y = bridgeDeckY(b, x);
        const slope = Math.atan2(1.4 * Math.PI / b.len * Math.cos(Math.PI * i / n), 1);
        this.put(GEO.box, i % 2 ? 0xb88050 : 0xa87048, x, y - 0.15, b.z, b.len / n + 0.05, 0.3, b.w, 0, 0, slope);
        if (i % 3 === 0) for (const s of [-1, 1]) {
          this.put(GEO.box, 0x7a4a30, x, y + 0.55, b.z + s * (b.w / 2 - 0.2), 0.25, 1.4, 0.25);
        }
      }
      for (const s of [-1, 1]) {
        for (let i = 0; i < n; i++) {
          const x0 = b.x - b.len / 2 + i / n * b.len, x1 = x0 + b.len / n;
          const y0 = bridgeDeckY(b, x0), y1 = bridgeDeckY(b, x1);
          this.put(GEO.box, 0x8a5a3a, (x0 + x1) / 2, (y0 + y1) / 2 + 1.15, b.z + s * (b.w / 2 - 0.2), b.len / n + 0.06, 0.16, 0.16, 0, 0, Math.atan2(y1 - y0, x1 - x0));
        }
        // supports
        for (const k of [0.25, 0.5, 0.75]) { const x = b.x - b.len / 2 + k * b.len; this.put(GEO.cyl, 0x6a4a30, x, -1.6, b.z + s * (b.w / 2 - 0.4), 0.35, 4, 0.35); }
      }
    }
  }

  buildRuins() {
    const pillar = (x, z, h, broken) => {
      const y = this.heightAt(x, z);
      this.put(GEO.cyl, 0xc8c4b8, x, y + 0.3, z, 1.3, 0.6, 1.3);
      this.put(GEO.cyl, 0xd8d4c8, x, y + h / 2, z, 0.85, h, 0.85);
      if (!broken) { this.put(GEO.box, 0xc8c4b8, x, y + h + 0.3, z, 2.0, 0.6, 2.0); }
      else this.put(GEO.cyl, 0xd8d4c8, x + 1.5, y + 0.6, z + 0.6, 0.8, 2.6, 0.8, 0, 0.6, Math.PI / 2);
      this.put(GEO.sph, 0x6aa84a, x + 0.3, y + h * 0.4, z + 0.5, 0.6, 0.3, 0.5);
      this.blockCircle(x, z, 1.1);
    };
    const rng = mulberry(7);
    const nearGate = (x, z) => (this.gates || []).some((gt) => Math.hypot(x - gt.x, z - gt.z) < 15);
    // scattered ruins
    for (let i = 0; i < 26; i++) {
      const x = -70 - rng() * 100, z = -80 + rng() * 170;
      if (roadDist(x, z) < 7 || Math.hypot(x - ARENA.x, z - ARENA.z) < ARENA.r + 6) continue;
      if (Math.max(Math.abs(x), Math.abs(z)) > 168 || nearGate(x, z)) continue;
      pillar(x, z, 3 + rng() * 5, rng() < 0.5);
    }
    // broken walls
    for (let i = 0; i < 10; i++) {
      const x = -80 - rng() * 80, z = -60 + rng() * 140, r = rng() * Math.PI;
      if (roadDist(x, z) < 8 || Math.hypot(x - ARENA.x, z - ARENA.z) < ARENA.r + 8 || nearGate(x, z)) continue;
      const y = this.heightAt(x, z), L = 5 + rng() * 6;
      this.put(GEO.box, 0xc8c0b0, x, y + 1.0, z, L, 2.0 + rng() * 1.5, 1.0, 0, r, 0);
      this.put(GEO.box, 0xd8d0c0, x + Math.cos(r) * L * 0.25, y + 2.6, z - Math.sin(r) * L * 0.25, L * 0.5, 1.0, 1.0, 0, r, 0);
      this.blockRect(x, z, L, 1.2, r);
    }
    // glowing rune stones
    for (let i = 0; i < 8; i++) {
      const x = -90 - rng() * 60, z = -40 + rng() * 120;
      if (roadDist(x, z) < 6 || nearGate(x, z)) continue;
      const y = this.heightAt(x, z);
      this.put(GEO.box, 0x8a8478, x, y + 1.2, z, 1.2, 2.4, 0.6, 0, rng() * 3, 0.1);
      this.putGlow(GEO.box, 0x8af0ff, x, y + 1.4, z, 1.25, 0.12, 0.62, 0, 0, 0.1);
      this.blockCircle(x, z, 0.8);
    }
    // boss arena
    const st = stoneTexture().clone(); st.needsUpdate = true; st.repeat.set(5, 5);
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(ARENA.r, ARENA.r + 1, 0.6, 48), new THREE.MeshToonMaterial({ color: 0xc8c0d8, map: st, gradientMap: getGradient() }));
    floor.position.set(ARENA.x, 0.25, ARENA.z); floor.receiveShadow = true; this.root.add(floor);
    const mc = new THREE.Mesh(new THREE.CircleGeometry(14, 48), new THREE.MeshBasicMaterial({ map: magicCircleTexture('#c07aff'), transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
    mc.rotation.x = -Math.PI / 2; mc.position.set(ARENA.x, 0.6, ARENA.z); this.root.add(mc);
    this.anim.push((t) => { mc.rotation.z = -t * 0.15; });
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      const x = ARENA.x + Math.cos(a) * (ARENA.r + 1.5), z = ARENA.z + Math.sin(a) * (ARENA.r + 1.5);
      const toRoad = Math.atan2(-92 - ARENA.z, -146 - ARENA.x);
      if (Math.abs(Math.atan2(Math.sin(a - toRoad), Math.cos(a - toRoad))) < 0.35) continue;
      pillar(x, z, 6 + (i % 3) * 1.5, i % 4 === 1);
      this.putGlow(GEO.sph, 0xc07aff, x, this.heightAt(x, z) + 7.8 + (i % 3) * 1.5, z, 0.4, 0.4, 0.4);
    }
  }

  buildOverlook() {
    const { x, z } = OVERLOOK; const y = this.heightAt(x, z);
    this.put(GEO.cyl, 0xd8d0c4, x, y + 0.2, z, 8, 0.5, 8);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2, px = x + Math.cos(a) * 7, pz = z + Math.sin(a) * 7;
      if (Math.sin(a) > 0.8) continue;
      this.put(GEO.cyl6, 0xf4f0e8, px, y + 2.5, pz, 0.3, 4.6, 0.3);
      this.blockCircle(px, pz, 0.4);
    }
    this.put(GEO.cone8, 0x3ab0a0, x, y + 6.0, z, 8.6, 2.6, 8.6);
    this.put(GEO.sph, 0xf0c040, x, y + 7.5, z, 0.5, 0.5, 0.5);
  }

  // Landmarks that give each outer biome its own silhouette.
  buildBiomeProps() {
    const rng = mulberry(77);
    const okSpot = (x, z, m = 8) => !this.isBlocked(x, z) && roadDist(x, z) > m && riverDist(x, z) > 10 && !nearOutpost(x, z, 14) && !(this.gates || []).some((gt) => Math.hypot(x - gt.x, z - gt.z) < 16) && !(this.spawnAreas || []).some((sp) => Math.hypot(x - sp.x, z - sp.z) < sp.r * 0.6);
    const scatter = (zn, n, fn, m) => {
      for (let i = 0, k = 0; i < n * 12 && k < n; i++) {
        const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * zn.r * 0.95, x = zn.x + Math.cos(a) * r, z = zn.z + Math.sin(a) * r;
        if (Math.max(Math.abs(x), Math.abs(z)) > 365 || !okSpot(x, z, m) || this.heightAt(x, z) < WATER_Y + 0.2) continue;
        fn(x, this.heightAt(x, z), z); k++;
      }
    };
    for (const zn of NEW_ZONES) {
      switch (zn.biome) {
        case 'plains':
          scatter(zn, 16, (x, y, z) => { // sunflower patch
            for (let i = 0; i < 7; i++) { const px = x + (rng() - 0.5) * 6, pz = z + (rng() - 0.5) * 6, hgt = 1.6 + rng() * 0.8; this.put(GEO.cyl6, 0x5aa83a, px, y + hgt / 2, pz, 0.08, hgt, 0.08); this.put(GEO.cyl, 0xffd23a, px, y + hgt, pz, 0.55, 0.12, 0.55, Math.PI / 2 - 0.3, rng() * 6, 0); this.put(GEO.cyl, 0x7a4a1a, px, y + hgt + 0.02, pz, 0.24, 0.14, 0.24, Math.PI / 2 - 0.3, 0, 0); }
          }, 6);
          scatter(zn, 12, (x, y, z) => { this.put(GEO.cyl, 0xe8c860, x, y + 0.7, z, 1.3, 1.4, 1.3); this.put(GEO.cone8, 0xd8b850, x, y + 1.8, z, 1.4, 0.9, 1.4); this.blockCircle(x, z, 1.3); }, 8);
          scatter(zn, 2, (x, y, z) => { // windmill
            this.put(GEO.cyl, 0xf4ead8, x, y + 4, z, 2.2, 8, 2.2); this.put(GEO.cone8, 0xd8504a, x, y + 9.4, z, 2.8, 2.8, 2.8);
            for (let i = 0; i < 4; i++) this.put(GEO.box, 0xfff6e0, x, y + 7, z + 2.4, 0.5, 7, 0.1, 0, 0, i * Math.PI / 2 + 0.4);
            this.blockCircle(x, z, 2.6);
          }, 12);
          break;
        case 'marsh':
          scatter(zn, 40, (x, y, z) => { for (let i = 0; i < 6; i++) this.put(GEO.cone8, i % 2 ? 0x6a8a3a : 0x8a9a4a, x + (rng() - 0.5) * 2, y + 0.9, z + (rng() - 0.5) * 2, 0.08, 1.8 + rng(), 0.08); }, 4);
          for (let i = 0; i < 80; i++) { const a = rng() * Math.PI * 2, r = rng() * zn.r, x = zn.x + Math.cos(a) * r, z = zn.z + Math.sin(a) * r; if (this.heightAt(x, z) < WATER_Y - 0.3) { this.put(GEO.cyl, 0x5aa84a, x, WATER_Y + 0.03, z, 0.6 + rng() * 0.4, 0.04, 0.6 + rng() * 0.4); if (rng() < 0.4) this.putGlow(GEO.sph, 0xffb8e8, x + 0.2, WATER_Y + 0.15, z, 0.18, 0.12, 0.18); } }
          scatter(zn, 4, (x, y, z) => { // stilt hut
            for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) this.put(GEO.cyl6, 0x5a4a34, x + dx, y + 1.2, z + dz, 0.2, 2.4, 0.2);
            this.put(GEO.box, 0x8a6a44, x, y + 3.2, z, 4.2, 2.2, 4.2); this.put(GEO.roof, 0x6a7a3a, x, y + 5.1, z, 3.6, 1.8, 3.6);
            this.blockRect(x, z, 4.4, 4.4, 0);
          }, 10);
          break;
        case 'ember':
          scatter(zn, 26, (x, y, z) => { const hgt = 6 + rng() * 10, w = 1.6 + rng() * 2; this.put(GEO.cone8, rng() < 0.5 ? 0x8a3a24 : 0xa04a2a, x, y + hgt / 2 - 0.5, z, w, hgt, w, (rng() - 0.5) * 0.2, rng() * 3, (rng() - 0.5) * 0.2); this.blockCircle(x, z, w * 0.8); }, 7);
          scatter(zn, 10, (x, y, z) => { const r = 2 + rng() * 2.5; this.putGlow(GEO.cyl, 0xff7a1a, x, y + 0.08, z, r, 0.08, r); this.putGlow(GEO.cyl, 0xffd04a, x, y + 0.1, z, r * 0.55, 0.08, r * 0.55); this.put(GEO.torus, 0x4a2a20, x, y + 0.1, z, r, r, 2.4, Math.PI / 2, 0, 0); this.blockCircle(x, z, r); }, 9);
          break;
        case 'frost':
          scatter(zn, 26, (x, y, z) => { for (let i = 0; i < 3; i++) { const a = i * 2.1 + rng(); this.putGlow(GEO.oct, i % 2 ? 0xc8f4ff : 0x9ae0ff, x + Math.cos(a) * 0.7, y + 1.2, z + Math.sin(a) * 0.7, 0.5, 1.8 + rng() * 1.2, 0.5, Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3); } this.blockCircle(x, z, 1); }, 6);
          scatter(zn, 6, (x, y, z) => { this.put(GEO.sph, 0xffffff, x, y + 0.8, z, 0.9, 0.85, 0.9); this.put(GEO.sph, 0xffffff, x, y + 2, z, 0.62, 0.6, 0.62); this.put(GEO.sph, 0xffffff, x, y + 2.9, z, 0.45, 0.45, 0.45); this.put(GEO.cone8, 0xff8a2a, x, y + 2.9, z + 0.5, 0.08, 0.4, 0.08, Math.PI / 2, 0, 0); this.put(GEO.cyl, 0xd04a3a, x, y + 2.45, z, 0.55, 0.14, 0.55); this.blockCircle(x, z, 1); }, 8);
          break;
        case 'crystal':
          scatter(zn, 34, (x, y, z) => { const sc = 0.8 + rng() * 1.4; for (let i = 0; i < 4; i++) { const a = i * 1.6 + rng(); this.putGlow(GEO.oct, [0xc89aff, 0x9ae8ff, 0xffa8f0][i % 3], x + Math.cos(a) * 0.8 * sc, y + 1.4 * sc, z + Math.sin(a) * 0.8 * sc, 0.55 * sc, (2 + rng() * 1.5) * sc, 0.55 * sc, Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35); } this.blockCircle(x, z, 1.2 * sc); }, 6);
          break;
        case 'shadow':
          scatter(zn, 30, (x, y, z) => { this.put(GEO.box, 0x6a6478, x, y + 0.7, z, 0.9, 1.4, 0.3, 0, rng() * 3, (rng() - 0.5) * 0.3); this.put(GEO.cyl, 0x6a6478, x, y + 1.4, z, 0.45, 0.3, 0.45, Math.PI / 2, 0, 0); this.blockCircle(x, z, 0.6); }, 5);
          scatter(zn, 26, (x, y, z) => { for (let i = 0; i < 4; i++) { const px = x + (rng() - 0.5) * 2, pz = z + (rng() - 0.5) * 2, hh = 0.3 + rng() * 0.5; this.put(GEO.cyl6, 0xe0d8f0, px, y + hh / 2, pz, 0.08, hh, 0.08); this.putGlow(GEO.sph, rng() < 0.5 ? 0xb07aff : 0x7aff9a, px, y + hh, pz, 0.3, 0.16, 0.3); } }, 4);
          scatter(zn, 5, (x, y, z) => { const r = rng() * 3; for (const sx of [-1, 1]) { this.put(GEO.box, 0x5a5468, x + Math.cos(r) * sx * 3, y + 2.6, z - Math.sin(r) * sx * 3, 1.2, 5.2, 1.2, 0, r, 0); this.blockCircle(x + Math.cos(r) * sx * 3, z - Math.sin(r) * sx * 3, 0.9); } this.put(GEO.box, 0x5a5468, x, y + 5.6, z, 7.4, 1, 1.4, 0, r, 0); }, 10);
          break;
        case 'astral':
          scatter(zn, 16, (x, y, z) => { this.put(GEO.cyl, 0xf4f0ff, x, y + 3, z, 0.7, 6, 0.7); this.put(GEO.box, 0xe8e0f8, x, y + 6.2, z, 1.8, 0.4, 1.8); this.putGlow(GEO.sph, 0xfff0a0, x, y + 7, z, 0.6, 0.6, 0.6); this.blockCircle(x, z, 0.9); }, 6);
          scatter(zn, 20, (x, y, z) => { this.putGlow(GEO.oct, 0xfff4c8, x, y + 3 + rng() * 6, z, 0.3, 0.5, 0.3); }, 3);
          break;
        case 'sacred':
          scatter(zn, 10, (x, y, z) => { const r = rng() * 3; this.put(GEO.cyl, 0x8a6448, x, y + 1.5, z, 1.4, 14, 1.4, Math.PI / 2 - 0.25, r, 0); this.blockCircle(x, z, 1.6); }, 9);
          scatter(zn, 20, (x, y, z) => { for (let i = 0; i < 5; i++) this.putGlow(GEO.sph, 0xffe07a, x + (rng() - 0.5) * 2.4, y + 0.25, z + (rng() - 0.5) * 2.4, 0.2, 0.16, 0.2); }, 4);
          break;
      }
    }
  }

  // Homestead: fenced farmland west of town with a barn; plots themselves are placed by the game.
  buildFarm() {
    const { x, z } = FARM, y = this.heightAt(x, z);
    const R = 13;
    this.fence(x - R, z - R, x + R, z - R); this.fence(x - R, z + R, x + R, z + R);
    this.fence(x - R, z - R, x - R, z + R);
    this.fence(x + R, z - R, x + R, z - 3); this.fence(x + R, z + 3, x + R, z + R);
    this.house(x - 4, z - 9, 0, { w: 9, d: 6, h: 4.2, roof: 0xb83a2a, wall: 0xc8503a });
    for (const [dx, dz] of [[-10, -9], [-10, -6]]) { this.put(GEO.cyl, 0xe8c860, x + dx, y + 0.6, z + dz, 1, 1.2, 1, 0, 0, Math.PI / 2); this.blockCircle(x + dx, z + dz, 1); }
    // scarecrow
    this.put(GEO.cyl6, 0x7a5234, x + 8, y + 1.3, z - 8, 0.1, 2.6, 0.1); this.put(GEO.box, 0x7a5234, x + 8, y + 2, z - 8, 1.8, 0.12, 0.12);
    this.put(GEO.sph, 0xf0d890, x + 8, y + 2.8, z - 8, 0.38, 0.4, 0.38); this.put(GEO.cone8, 0x8a6a3a, x + 8, y + 3.2, z - 8, 0.6, 0.4, 0.6);
    this.put(GEO.box, 0x4a7ad8, x + 8, y + 1.9, z - 8, 0.7, 0.8, 0.3);
    this.farmPlots = [];
    for (let row = 0; row < 2; row++) for (let col = 0; col < 4; col++) this.farmPlots.push({ x: x - 7.5 + col * 5, z: z + 0.5 + row * 5.5 });
  }

  // Outpost camps at the edge of each new zone: tent, campfire, crates and a banner.
  buildOutposts() {
    this.campfires = [];
    for (const o of OUTPOSTS) {
      const bx = o.x - Math.sin(o.face) * 4.5, bz = o.z - Math.cos(o.face) * 4.5, y = this.heightAt(bx, bz);
      this.put(GEO.cone4, 0xe8d8b0, bx, y + 1.6, bz, 2.6, 3.2, 2.6, 0, o.face + Math.PI / 4, 0);
      this.put(GEO.box, 0x6a4a2a, bx, y + 0.9, bz + 0.01, 0.9, 1.8, 0.1, 0, o.face, 0);
      this.blockCircle(bx, bz, 2.2);
      const fx = o.x + Math.cos(o.face) * 3.2, fz = o.z - Math.sin(o.face) * 3.2, fy = this.heightAt(fx, fz);
      for (let i = 0; i < 3; i++) this.put(GEO.cyl6, 0x5a3a24, fx, fy + 0.2, fz, 0.12, 1.2, 0.12, Math.PI / 2, i * 1.05, 0);
      this.putGlow(GEO.cone8, 0xffa040, fx, fy + 0.6, fz, 0.35, 0.8, 0.35);
      this.putGlow(GEO.cone8, 0xffe07a, fx, fy + 0.5, fz, 0.18, 0.5, 0.18);
      this.blockCircle(fx, fz, 0.8);
      this.campfires.push([fx, fy + 0.8, fz]);
      const cx = o.x - Math.cos(o.face) * 3, cz = o.z + Math.sin(o.face) * 3, cy = this.heightAt(cx, cz);
      this.put(GEO.box, 0x9a6a3a, cx, cy + 0.45, cz, 0.9, 0.9, 0.9, 0, o.face, 0); this.put(GEO.box, 0x8a5a2a, cx + 0.3, cy + 1.2, cz, 0.6, 0.6, 0.6, 0, o.face + 0.4, 0);
      this.blockCircle(cx, cz, 0.8);
      this.put(GEO.cyl6, 0x7a5234, bx + 2.4, y + 2.5, bz, 0.08, 5, 0.08); this.put(GEO.box, 0x2a7ad8, bx + 2.4 + 0.6, y + 4.4, bz, 1.2, 0.8, 0.04);
    }
    const lm = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffa040, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 });
    for (const [x, y, z] of this.campfires) { const sp = new THREE.Sprite(lm); sp.position.set(x, y, z); sp.scale.setScalar(4); sp.raycast = () => {}; this.root.add(sp); }
    this.anim.push((t) => { lm.opacity = 0.65 + Math.sin(t * 9) * 0.1 + Math.sin(t * 5.3) * 0.08; });
  }

  // Storm Altar: a rune platform ringed by standing stones where world bosses descend.
  buildAltar() {
    const { x, z, r } = ALTAR;
    const st = stoneTexture().clone(); st.needsUpdate = true; st.repeat.set(4, 4);
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.8, 0.6, 48), new THREE.MeshToonMaterial({ color: 0xb8c4d8, map: st, gradientMap: getGradient() }));
    floor.position.set(x, 0.2, z); floor.receiveShadow = true; this.root.add(floor);
    const mc = new THREE.Mesh(new THREE.CircleGeometry(r * 0.75, 48), new THREE.MeshBasicMaterial({ map: magicCircleTexture('#7ad8ff'), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    mc.rotation.x = -Math.PI / 2; mc.position.set(x, 0.53, z); this.root.add(mc);
    this.anim.push((t) => { mc.rotation.z = t * 0.12; mc.material.opacity = 0.45 + Math.sin(t * 1.3) * 0.12; });
    const face = Math.atan2(-x, -z);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a - face), Math.cos(a - face))) < 0.4) continue; // opening toward town
      const px = x + Math.cos(a) * (r + 1.6), pz = z + Math.sin(a) * (r + 1.6), y = this.heightAt(px, pz), h = 4 + (i % 3) * 1.2;
      this.put(GEO.box, 0x8a92a8, px, y + h / 2, pz, 1.3, h, 0.8, 0, -a, 0);
      this.putGlow(GEO.box, 0x7ad8ff, px, y + h * 0.62, pz, 1.34, 0.16, 0.84, 0, -a, 0);
      this.put(GEO.box, 0x9aa2b8, px, y + h + 0.2, pz, 1.5, 0.4, 1.0, 0, -a, 0);
      this.blockCircle(px, pz, 0.9);
    }
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const px = x + dx * r * 0.62, pz = z + dz * r * 0.62;
      this.put(GEO.cyl6, 0x6a7288, px, 1.6, pz, 0.35, 2.4, 0.35);
      this.putGlow(GEO.oct, 0x9ae8ff, px, 3.3, pz, 0.4, 0.75, 0.4);
      this.blockCircle(px, pz, 0.5);
    }
  }

  buildDungeonGates() {
    this.gates = [];
    for (const d of DUNGEONS) {
      const g = buildDungeonEntrance(d.theme);
      const { x, z } = d.portal;
      const yaw = Math.atan2(-x, -z);
      g.position.set(x, this.heightAt(x, z), z); g.rotation.y = yaw;
      this.root.add(g);
      const r = g.userData.radius || 4.5;
      this.blockCircle(x - Math.sin(yaw) * r * 0.45, z - Math.cos(yaw) * r * 0.45, r * 0.7);
      const fd = r * 0.5 + 2.5;
      const front = { x: x + Math.sin(yaw) * fd, z: z + Math.cos(yaw) * fd };
      this.gates.push({ def: d, model: g, x, z, yaw, front, radius: r });
      if (g.userData.update) this.anim.push((t) => g.userData.update(t));
    }
  }

  buildTrees() {
    const rng = mulberry(42);
    const greens = [0x5cb84a, 0x6ac850, 0x4aa840, 0x7ad458];
    const tree = (x, z, kind, s) => {
      const y = this.heightAt(x, z) - 0.2;
      if (kind === 'pine') {
        this.put(GEO.cyl6, 0x7a5234, x, y + 1.2 * s, z, 0.35 * s, 2.4 * s, 0.35 * s);
        for (let i = 0; i < 3; i++) this.put(GEO.cone8, [0x3a8a4a, 0x429a52, 0x4aa85a][i], x, y + (3.0 + i * 1.6) * s, z, (2.6 - i * 0.6) * s, (3.0 - i * 0.3) * s, (2.6 - i * 0.6) * s);
      } else if (kind === 'blossom') {
        this.put(GEO.cyl6, 0x7a5234, x, y + 1.5 * s, z, 0.35 * s, 3 * s, 0.35 * s);
        const cols = [0xffb6d0, 0xffc8dc, 0xff9ac0];
        for (const [dx, dy, dz, r] of [[0, 3.8, 0, 2.2], [1.3, 3.3, 0.4, 1.6], [-1.2, 3.4, -0.3, 1.7], [0.2, 4.8, -0.2, 1.4]]) this.put(GEO.sph, cols[(Math.abs(dx * 3) | 0) % 3], x + dx * s, y + dy * s, z + dz * s, r * s, r * s * 0.9, r * s);
      } else if (kind === 'big') {
        this.put(GEO.cyl, 0x6a4628, x, y + 3.5 * s, z, 0.9 * s, 7 * s, 0.9 * s);
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; this.put(GEO.cyl6, 0x6a4628, x + Math.cos(a) * 1.0 * s, y + 0.4 * s, z + Math.sin(a) * 1.0 * s, 0.35 * s, 1.6 * s, 0.35 * s, Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7); }
        for (const [dx, dy, dz, r] of [[0, 8.5, 0, 3.8], [2.5, 7.3, 0.8, 2.7], [-2.4, 7.5, -0.6, 2.9], [0.4, 10.2, -0.3, 2.6], [0.5, 7.4, 2.4, 2.4], [-0.6, 7.6, -2.5, 2.5]]) this.put(GEO.sph, greens[(Math.abs(dx * 7 + dz) | 0) % 4] - 0x101008, x + dx * s, y + dy * s, z + dz * s, r * s, r * s * 0.85, r * s);
      } else if (kind === 'snowpine') {
        this.put(GEO.cyl6, 0x6a4a34, x, y + 1.2 * s, z, 0.35 * s, 2.4 * s, 0.35 * s);
        for (let i = 0; i < 3; i++) {
          this.put(GEO.cone8, [0x3a7a6a, 0x428a72, 0x4a9a7a][i], x, y + (3.0 + i * 1.6) * s, z, (2.6 - i * 0.6) * s, (3.0 - i * 0.3) * s, (2.6 - i * 0.6) * s);
          this.put(GEO.cone8, 0xf4faff, x, y + (3.7 + i * 1.6) * s, z, (1.6 - i * 0.38) * s, (1.3 - i * 0.12) * s, (1.6 - i * 0.38) * s);
        }
      } else if (kind === 'dead' || kind === 'charred') {
        const col = kind === 'dead' ? 0x6a5a44 : 0x2e2622;
        this.put(GEO.cyl6, col, x, y + 2 * s, z, 0.38 * s, 4 * s, 0.38 * s);
        for (const [a, h2] of [[0.6, 3], [2.4, 3.6], [4.2, 2.6]]) {
          this.put(GEO.cyl6, col, x + Math.cos(a) * 0.8 * s, y + h2 * s, z + Math.sin(a) * 0.8 * s, 0.14 * s, 1.9 * s, 0.14 * s, Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
          if (kind === 'charred') this.putGlow(GEO.cone8, 0xff7a2a, x + Math.cos(a) * 1.5 * s, y + (h2 + 0.7) * s, z + Math.sin(a) * 1.5 * s, 0.16 * s, 0.4 * s, 0.16 * s);
        }
      } else if (kind === 'willow') {
        this.put(GEO.cyl6, 0x6a5a3a, x, y + 1.7 * s, z, 0.42 * s, 3.4 * s, 0.42 * s);
        this.put(GEO.sph, 0x5a8a44, x, y + 3.9 * s, z, 2.1 * s, 1.3 * s, 2.1 * s);
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; this.put(GEO.sph, i % 2 ? 0x6a9a4a : 0x5a8a44, x + Math.cos(a) * 1.6 * s, y + 2.8 * s, z + Math.sin(a) * 1.6 * s, 0.6 * s, 1.5 * s, 0.6 * s); }
      } else if (kind === 'crystal') {
        this.put(GEO.cyl6, 0x5a4a8a, x, y + 1.6 * s, z, 0.32 * s, 3.2 * s, 0.32 * s);
        for (const [dx, dy, dz, r, c] of [[0, 4, 0, 1.2, 0xc89aff], [1, 3.4, 0.3, 0.8, 0x9ae8ff], [-0.9, 3.5, -0.3, 0.85, 0xe0a8ff], [0.2, 4.9, -0.2, 0.7, 0x9ae8ff]]) this.putGlow(GEO.oct, c, x + dx * s, y + dy * s, z + dz * s, r * s * 0.8, r * s * 1.4, r * s * 0.8);
      } else if (kind === 'twisted') {
        this.put(GEO.cyl6, 0x3a2a44, x, y + 1.8 * s, z, 0.4 * s, 3.8 * s, 0.4 * s, 0.18, 0, 0.12);
        for (const [dx, dy, dz, r] of [[0.4, 3.9, 0, 1.6], [1.4, 3.3, 0.5, 1.1], [-0.9, 3.4, -0.4, 1.2]]) this.put(GEO.sph, 0x4a3a66, x + dx * s, y + dy * s, z + dz * s, r * s, r * s * 0.8, r * s);
        this.putGlow(GEO.sph, 0xb07aff, x + 0.5 * s, y + 0.3, z + 0.6 * s, 0.25 * s, 0.18 * s, 0.25 * s);
      } else if (kind === 'star') {
        this.put(GEO.cyl6, 0xf4f0e8, x, y + 1.6 * s, z, 0.3 * s, 3.2 * s, 0.3 * s);
        for (const [dx, dy, dz, r] of [[0, 4, 0, 1.5], [1.2, 3.4, 0.4, 1], [-1.1, 3.5, -0.3, 1.05], [0.2, 4.9, -0.2, 0.9]]) this.putGlow(GEO.sph, r > 1.2 ? 0xfff2b8 : 0xffffff, x + dx * s, y + dy * s, z + dz * s, r * s, r * s * 0.9, r * s);
      } else if (kind === 'olive') {
        this.put(GEO.cyl6, 0x8a6a48, x, y + 1.3 * s, z, 0.3 * s, 2.6 * s, 0.3 * s, 0, 0, 0.15);
        for (const [dx, dy, dz, r] of [[0.3, 3.0, 0, 1.4], [-0.8, 2.6, 0.4, 1.0], [0.8, 2.4, -0.6, 0.9]]) this.put(GEO.sph, 0x9ab048, x + dx * s, y + dy * s, z + dz * s, r * s, r * s * 0.8, r * s);
      } else {
        this.put(GEO.cyl6, 0x7a5234, x, y + 1.4 * s, z, 0.38 * s, 2.8 * s, 0.38 * s);
        const g = greens[(rng() * 4) | 0];
        for (const [dx, dy, dz, r] of [[0, 3.8, 0, 2.1], [1.2, 3.1, 0.4, 1.5], [-1.1, 3.2, -0.3, 1.6], [0.2, 4.7, -0.2, 1.3]]) this.put(GEO.sph, g, x + dx * s, y + dy * s, z + dz * s, r * s, r * s * 0.9, r * s);
      }
      this.blockCircle(x, z, (kind === 'big' ? 1.0 : 0.45) * s);
      this.treeSpots.push([x, z, kind, s]);
    };
    const ok = (x, z, spawns) => {
      if (Math.max(Math.abs(x), Math.abs(z)) > 372 || nearFarm(x, z, 6) || nearOutpost(x, z, 12)) return false;
      for (const gt of this.gates || []) if (Math.hypot(x - gt.x, z - gt.z) < 15) return false;
      if (Math.hypot(x, z) < 64) return false;
      if (roadDist(x, z) < 7 || riverDist(x, z) < 11) return false;
      if (Math.hypot(x - ARENA.x, z - ARENA.z) < ARENA.r + 6) return false;
      if (Math.hypot(x - OVERLOOK.x, z - OVERLOOK.z) < 20 || nearAltar(x, z, 8)) return false;
      if (this.isBlocked(x, z)) return false;
      for (const s of spawns) if (Math.hypot(x - s.x, z - s.z) < s.r * 0.75) return false;
      return true;
    };
    const spawns = this.spawnAreas || [];
    let placed = 0;
    for (let i = 0; i < 3200 && placed < 330; i++) {
      const x = -175 + rng() * 350, z = -175 + rng() * 350;
      const forest = z > 60 && x < 85, ruins = x < -60, meadow = x > 75 && z < 70;
      const p = forest ? 0.55 : ruins ? 0.18 : meadow ? 0.08 : 0.22;
      if (rng() > p) continue;
      if (!ok(x, z, spawns)) continue;
      let kind = 'round';
      if (forest) kind = rng() < 0.35 ? 'big' : rng() < 0.5 ? 'pine' : 'round';
      else if (ruins) kind = rng() < 0.6 ? 'olive' : 'round';
      else if (z < -60) kind = rng() < 0.6 ? 'pine' : 'round';
      else if (rng() < 0.15) kind = 'blossom';
      tree(x, z, kind, 0.85 + rng() * 0.45);
      placed++;
    }
    // the wider world: each biome has its own trees and density
    const BIOME_TREES = { plains: [0.07, ['round', 'round', 'blossom']], marsh: [0.32, ['willow', 'dead', 'willow']], ember: [0.1, ['charred', 'dead']], frost: [0.42, ['snowpine', 'snowpine', 'dead']], crystal: [0.28, ['crystal', 'crystal', 'pine']], shadow: [0.38, ['twisted', 'dead', 'twisted']], astral: [0.16, ['star', 'star', 'round']], sacred: [0.3, ['big', 'blossom', 'round']] };
    let outer = 0;
    for (let i = 0; i < 16000 && outer < 1150; i++) {
      const x = -372 + rng() * 744, z = -372 + rng() * 744;
      if (Math.abs(x) < 185 && Math.abs(z) < 185) continue;
      const b = biomeAt(x, z), def = BIOME_TREES[b] || [0.2, ['round', 'pine']];
      if (rng() > def[0]) continue;
      if (!ok(x, z, spawns) || this.heightAt(x, z) < WATER_Y + 0.2) continue;
      tree(x, z, def[1][(rng() * def[1].length) | 0], 0.85 + rng() * 0.55);
      outer++;
    }
    // town trees
    for (const [x, z, k] of [[10, 28, 'blossom'], [-24, -42, 'round'], [26, -44, 'blossom'], [-48, 14, 'round'], [48, 46, 'round'], [-50, -36, 'pine'], [14, 50, 'blossom'], [-28, 46, 'blossom'], [50, -30, 'pine'], [-8, -52, 'round'], [8, -52, 'round']]) tree(x, z, k, k === 'blossom' ? 1.3 : 1.1);
    this.sacredTree = { x: 10, z: 28 };
  }

  buildGroundCover() {
    const rng = mulberry(99);
    const tuft = new THREE.ConeGeometry(0.12, 0.7, 3); tuft.translate(0, 0.35, 0);
    const pts = [];
    for (let i = 0; i < 40000 && pts.length < 13000; i++) {
      const x = -370 + rng() * 740, z = -370 + rng() * 740;
      if (Math.hypot(x, z) < 18 || roadDist(x, z) < 3.5 || riverDist(x, z) < 8 || Math.hypot(x - ARENA.x, z - ARENA.z) < ARENA.r + 1 || nearAltar(x, z, 1) || nearFarm(x, z, 0)) continue;
      if (this.heightAt(x, z) < WATER_Y + 0.15) continue;
      pts.push([x, z]);
    }
    const TUFT = { plains: 0xb8d850, marsh: 0x5a8a3a, ember: 0xa07a3a, frost: 0xd8e8f0, crystal: 0xa08ae0, shadow: 0x5a4a70, astral: 0xe0d8f4, sacred: 0x8ad86a };
    const im = new THREE.InstancedMesh(tuft, new THREE.MeshLambertMaterial({ color: 0xffffff }), pts.length * 3);
    const m = new THREE.Matrix4(), c = new THREE.Color();
    let k = 0;
    for (const [x, z] of pts) {
      const bio = biomeAt(x, z);
      const y = this.heightAt(x, z), base = bio ? TUFT[bio] : z > 60 && x < 85 ? 0x4a9a3a : x > 75 ? 0x8ad050 : 0x6ac048;
      for (let j = 0; j < 3; j++) {
        m.compose(new THREE.Vector3(x + (rng() - 0.5) * 0.5, y - 0.05, z + (rng() - 0.5) * 0.5), new THREE.Quaternion().setFromEuler(new THREE.Euler((rng() - 0.5) * 0.6, rng() * 3, (rng() - 0.5) * 0.6)), new THREE.Vector3(1, 0.7 + rng() * 0.8, 1));
        im.setMatrixAt(k, m); c.setHex(base).multiplyScalar(0.85 + rng() * 0.35); im.setColorAt(k, c); k++;
      }
    }
    im.instanceMatrix.needsUpdate = true; this.root.add(im);
    // flowers
    const fgeo = new THREE.SphereGeometry(0.2, 6, 4); fgeo.scale(1, 0.6, 1); fgeo.translate(0, 0.25, 0);
    const fl = [];
    for (let i = 0; i < 16000 && fl.length < 5200; i++) {
      const x = -370 + rng() * 740, z = -370 + rng() * 740;
      if (Math.hypot(x, z) < 18 || roadDist(x, z) < 3.5 || riverDist(x, z) < 9 || nearFarm(x, z, 0) || this.heightAt(x, z) < WATER_Y + 0.15) continue;
      const meadow = x > 70 || (Math.hypot(x, z) < 60) || biomeAt(x, z) === 'plains';
      if (!meadow && rng() < 0.6) continue;
      fl.push([x, z]);
    }
    const fim = new THREE.InstancedMesh(fgeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), fl.length);
    const fcols = [0xff7aa0, 0xffe066, 0xffffff, 0xc89aff, 0x7ac8ff, 0xff9a5a];
    const FLOWER = { plains: [0xffe04a, 0xffb03a, 0xffffff], marsh: [0xc89aff, 0xfff08a], ember: [0xff6a2a, 0xffb03a], frost: [0xffffff, 0x9ae8ff], crystal: [0xd8a8ff, 0x9ae8ff], shadow: [0xb07aff, 0x7aff9a], astral: [0xfff2b8, 0xffffff], sacred: [0xffe07a, 0xff9ad0] };
    fl.forEach(([x, z], i) => {
      const fc = FLOWER[biomeAt(x, z)] || fcols;
      m.makeTranslation(x, this.heightAt(x, z), z); fim.setMatrixAt(i, m); fim.setColorAt(i, c.setHex(fc[(rng() * fc.length) | 0]));
    });
    fim.instanceMatrix.needsUpdate = true; this.root.add(fim);
    // rocks
    const ROCK = { ember: 0x9a5a3a, frost: 0xe0ecf4, crystal: 0x8a7ab8, shadow: 0x4a4258, astral: 0xd8d4e8, marsh: 0x6a7a5a };
    for (let i = 0; i < 300; i++) {
      const x = -370 + rng() * 740, z = -370 + rng() * 740;
      if (Math.hypot(x, z) < 62 || roadDist(x, z) < 6 || riverDist(x, z) < 9 || this.isBlocked(x, z) || nearAltar(x, z, 5) || nearFarm(x, z, 3) || nearOutpost(x, z, 10)) continue;
      if ((this.gates || []).some((gt) => Math.hypot(x - gt.x, z - gt.z) < 14)) continue;
      const s = 0.6 + rng() * 1.4, y = this.heightAt(x, z);
      this.put(GEO.dode, ROCK[biomeAt(x, z)] ?? 0xa8a49a, x, y + s * 0.3, z, s, s * 0.7, s * 1.1, rng(), rng() * 3, 0);
      if (s > 1.2) this.blockCircle(x, z, s * 0.8);
    }
  }

  buildBoundary() {
    const rng = mulberry(5);
    const E = HALF - 22;
    // big rocks along the edge
    for (let i = 0; i < 96; i++) {
      const side = i % 4, t = -E + rng() * E * 2;
      const x = side === 0 ? E + rng() * 15 : side === 1 ? -E - rng() * 15 : t;
      const z = side === 2 ? E + rng() * 15 : side === 3 ? -E - rng() * 15 : t;
      const sc = 4 + rng() * 5;
      this.put(GEO.dode, rng() < 0.5 ? 0x9a948a : 0x8a8a90, x, this.heightAt(x, z) + sc * 0.2, z, sc, sc * 1.2, sc, rng(), rng() * 3, rng());
    }
    // mountain wall hugging the map edge plus a distant ring, batched into two flat-shaded meshes
    const cone6 = new THREE.ConeGeometry(1, 1, 6), cone7 = new THREE.ConeGeometry(1, 1, 7);
    const wall = new Batch(), ring = new Batch();
    for (let side = 0; side < 4; side++) for (let k = -10; k <= 10; k++) {
      const t = k * 40 + (rng() - 0.5) * 14, off = HALF + 14 + rng() * 22;
      const x = side < 2 ? (side ? -off : off) : t, z = side < 2 ? t : (side === 2 ? off : -off);
      const north = side === 3 && Math.abs(t) < 110;
      const hgt = (north ? 40 : 60) + rng() * 45, w = 34 + rng() * 16, ry = rng() * 3;
      wall.add(cone6, rng() < 0.5 ? 0x7aa078 : 0x8a9a88, M(x, hgt / 2 + 6, z, w, hgt, w, 0, ry, 0));
      wall.add(cone6, 0xf4f8ff, M(x, hgt + 6 - hgt * 0.16 + 0.3, z, w * 0.32, hgt * 0.32, w * 0.32, 0, ry, 0));
    }
    for (let i = 0; i < 76; i++) {
      const a = i / 76 * Math.PI * 2 + rng() * 0.08, r = HALF + 80 + rng() * 90;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const north = z < 0 && Math.abs(x) < 160;
      const h = (north ? 50 : 85) + rng() * 70, w = 55 + rng() * 40, ry = rng() * 3;
      ring.add(cone7, rng() < 0.5 ? 0x6a9a7a : 0x5a8a8a, M(x, h / 2 - 10, z, w, h, w, 0, ry, 0));
      ring.add(cone7, 0xf4f8ff, M(x, h - 10 - h * 0.15 + 0.5, z, w * 0.3, h * 0.3, w * 0.3, 0, ry, 0));
    }
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    for (const b of [wall, ring]) { const g = b.build(); if (g) this.root.add(new THREE.Mesh(g, mat)); }
  }

  buildWorldTree() {
    const { x, z } = WORLD_TREE;
    const g = new THREE.Group(); g.position.set(x, -40, z); g.scale.setScalar(1.6);
    const bark = toon(0x8a6448);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(26, 44, 340, 18), bark); trunk.position.y = 170; g.add(trunk);
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2;
      const r = new THREE.Mesh(new THREE.CylinderGeometry(6, 14, 120, 8), bark);
      r.position.set(Math.cos(a) * 52, 20, Math.sin(a) * 52); r.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); g.add(r);
    }
    const leafA = toon(0x7ad87a), leafB = toon(0x9ae88a), leafC = toon(0x5ac06a);
    const rng = mulberry(3);
    for (let i = 0; i < 26; i++) {
      const a = rng() * Math.PI * 2, r = rng() * 160, y = 330 + rng() * 120 - r * 0.35;
      const s = new THREE.Mesh(new THREE.SphereGeometry(55 + rng() * 45, 14, 10), [leafA, leafB, leafC][i % 3]);
      s.position.set(Math.cos(a) * r, y, Math.sin(a) * r); g.add(s);
    }
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      const br = new THREE.Mesh(new THREE.CylinderGeometry(5, 10, 160, 8), bark);
      br.position.set(Math.cos(a) * 60, 300, Math.sin(a) * 60); br.rotation.set(Math.sin(a) * 1.0, 0, -Math.cos(a) * 1.0); g.add(br);
    }
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xd8ffd0, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 }));
    halo.scale.setScalar(700); halo.position.y = 360; g.add(halo);
    this.root.add(g);
    this.worldTree = g;
  }

  buildIslands() {
    const rng = mulberry(11);
    this.islands = [];
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.45 + rng() * 0.2, r = 520 + rng() * 160;
      const g = new THREE.Group(); const s = 10 + rng() * 14;
      const rock = new THREE.Mesh(new THREE.ConeGeometry(s, s * 2.2, 7), new THREE.MeshLambertMaterial({ color: 0x9a7a5a, flatShading: true })); rock.rotation.x = Math.PI; rock.position.y = -s * 1.1; g.add(rock);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(s * 1.02, s, s * 0.35, 7), toon(0x7ad458)); top.position.y = s * 0.12; g.add(top);
      const tr = new THREE.Mesh(new THREE.SphereGeometry(s * 0.45, 10, 8), toon(0x5ab84a)); tr.position.set(s * 0.2, s * 0.9, 0); g.add(tr);
      const tk = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.06, s * 0.09, s * 0.7, 6), toon(0x7a5234)); tk.position.set(s * 0.2, s * 0.45, 0); g.add(tk);
      g.position.set(Math.cos(a) * r, 90 + rng() * 110, Math.sin(a) * r);
      g.userData.base = g.position.y; g.userData.ph = rng() * 6;
      this.root.add(g); this.islands.push(g);
    }
  }

  finishBatches() {
    const toonMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: getGradient() });
    const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const om = outlineMaterial(0.05, 0x3a2a24);
    for (const { toon: tb, glow: gb } of this.batches.values()) {
      const g = tb.build();
      if (g) {
        const m = new THREE.Mesh(g, toonMat); m.castShadow = true; m.receiveShadow = true; this.root.add(m);
        const o = new THREE.Mesh(g, om); this.root.add(o);
      }
      const gg = gb.build(); if (gg) this.root.add(new THREE.Mesh(gg, glowMat));
    }
    // lamp halos
    const lm = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffd27a, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 });
    for (const [x, y, z] of this.lampGlows) { const s = new THREE.Sprite(lm); s.position.set(x, y, z); s.scale.setScalar(2.6); this.root.add(s); }
  }

  buildAmbient() {
    // fountain spray
    const N = 160, pos = new Float32Array(N * 3), vel = new Float32Array(N * 3);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const spray = new THREE.Points(geo, new THREE.PointsMaterial({ map: glowTexture(), color: 0xbfefff, size: 0.55, transparent: true, depthWrite: false, opacity: 0.9 }));
    this.root.add(spray);
    const reset = (i) => { pos[i * 3] = (Math.random() - 0.5) * 0.4; pos[i * 3 + 1] = 4.2; pos[i * 3 + 2] = (Math.random() - 0.5) * 0.4; const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 1.6; vel[i * 3] = Math.cos(a) * s; vel[i * 3 + 1] = 3 + Math.random() * 2.5; vel[i * 3 + 2] = Math.sin(a) * s; };
    for (let i = 0; i < N; i++) { reset(i); pos[i * 3 + 1] = 1 + Math.random() * 3; }
    this.anim.push((t, dt) => {
      for (let i = 0; i < N; i++) {
        vel[i * 3 + 1] -= 9 * dt;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        if (pos[i * 3 + 1] < 1.0) reset(i);
      }
      geo.attributes.position.needsUpdate = true;
    });
    // fireflies in the forest
    const F = 220, fp = new Float32Array(F * 3), fb = [];
    const rng = mulberry(17);
    for (let i = 0; i < F; i++) { const x = -60 + rng() * 140, z = 70 + rng() * 100; fb.push([x, z, rng() * 6]); }
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
    const ff = new THREE.Points(fg, new THREE.PointsMaterial({ map: glowTexture(), color: 0xd8ff7a, size: 0.9, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.root.add(ff);
    this.anim.push((t) => {
      for (let i = 0; i < F; i++) { const [x, z, p] = fb[i]; fp[i * 3] = x + Math.sin(t * 0.5 + p) * 2; fp[i * 3 + 2] = z + Math.cos(t * 0.4 + p * 1.3) * 2; fp[i * 3 + 1] = this.heightAt(x, z) + 1.2 + Math.sin(t * 0.8 + p * 2) * 0.9; }
      fg.attributes.position.needsUpdate = true;
    });
    // butterflies
    const wingGeo = new THREE.PlaneGeometry(0.45, 0.35); wingGeo.translate(0.22, 0, 0);
    for (let i = 0; i < 18; i++) {
      const col = [0xffa8d8, 0xfff08a, 0x9ad8ff, 0xffffff, 0xffb86a][i % 5];
      const mat = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide });
      const b = new THREE.Group(); const l = new THREE.Mesh(wingGeo, mat), r = new THREE.Mesh(wingGeo, mat); r.scale.x = -1; b.add(l); b.add(r);
      const cx = i < 8 ? (rng() - 0.5) * 80 : 80 + rng() * 70, cz = i < 8 ? (rng() - 0.5) * 80 : -40 + rng() * 100, ph = rng() * 6;
      this.root.add(b);
      this.anim.push((t) => {
        const a = t * 0.4 + ph;
        b.position.set(cx + Math.cos(a) * 6, this.heightAt(cx, cz) + 1.5 + Math.sin(t * 1.3 + ph) * 0.6, cz + Math.sin(a * 1.3) * 6);
        b.rotation.y = -a; const f = Math.sin(t * 18 + ph) * 1.1; l.rotation.y = f; r.rotation.y = -f;
      });
    }
  }

  // Weather of the outer biomes: snow, rising embers, marsh spores, astral sparkles.
  buildBiomeWeather() {
    const kinds = { frost: [0xffffff, 1.0, -1], ember: [0xff8a3a, 0.7, 1], marsh: [0xc8ff8a, 0.6, 0.3], shadow: [0xb07aff, 0.7, 0.4], astral: [0xfff2b8, 0.8, 0.2], crystal: [0xd8b8ff, 0.6, 0.3] };
    for (const zn of NEW_ZONES) {
      const k = kinds[zn.biome]; if (!k) continue;
      const N = 360, pos = new Float32Array(N * 3), seeds = [];
      const rng = mulberry(zn.x * 7 + zn.z);
      for (let i = 0; i < N; i++) { const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * zn.r; seeds.push([zn.x + Math.cos(a) * r, zn.z + Math.sin(a) * r, rng() * 20]); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ map: glowTexture(), color: k[0], size: k[1], transparent: true, depthWrite: false, blending: zn.biome === 'frost' ? THREE.NormalBlending : THREE.AdditiveBlending }));
      pts.frustumCulled = false; this.root.add(pts);
      const base = seeds.map(([x, z]) => this.heightAt(x, z));
      this.anim.push((t) => {
        for (let i = 0; i < N; i++) {
          const [x, z, p] = seeds[i], cyc = (t * 0.6 + p) % 14;
          pos[i * 3] = x + Math.sin(t * 0.4 + p) * 2;
          pos[i * 3 + 2] = z + Math.cos(t * 0.33 + p) * 2;
          pos[i * 3 + 1] = base[i] + (k[2] < 0 ? 14 - cyc : k[2] > 0.5 ? cyc : 0.8 + Math.sin(t + p) * 0.6 + cyc * k[2] * 0.5);
        }
        g.attributes.position.needsUpdate = true;
      });
    }
  }

  buildMinimap() {
    const S = 800; const c = document.createElement('canvas'); c.width = S; c.height = S; const g = c.getContext('2d');
    const img = g.createImageData(S, S);
    const col = this.terrain.geometry.attributes.color;
    const W = SEG + 1;
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
      const ix = Math.min(SEG, Math.round(px / S * SEG)), iz = Math.min(SEG, Math.round(py / S * SEG));
      const i = iz * W + ix;
      const h = this.heights[i], hx = this.heights[iz * W + Math.min(SEG, ix + 1)];
      let r = col.getX(i), gg = col.getY(i), b = col.getZ(i);
      if (h < WATER_Y) { r = 0.25; gg = 0.6; b = 0.88; }
      const shade = 1 + (h - hx) * 0.12;
      const o = (py * S + px) * 4;
      img.data[o] = Math.min(255, Math.pow(r, 1 / 2.2) * 255 * shade); img.data[o + 1] = Math.min(255, Math.pow(gg, 1 / 2.2) * 255 * shade); img.data[o + 2] = Math.min(255, Math.pow(b, 1 / 2.2) * 255 * shade); img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const toPx = (v) => (v + HALF) / SIZE * S;
    g.fillStyle = 'rgba(40,90,40,0.55)';
    for (const [x, z, , s] of this.treeSpots) { g.beginPath(); g.arc(toPx(x), toPx(z), 1.6 * s, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#c8b8a0'; g.beginPath(); g.arc(toPx(0), toPx(0), 17 / SIZE * S, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#9a6a5a'; g.strokeStyle = '#4a2a20'; g.lineWidth = 1;
    for (const b of this.buildings) {
      g.save(); g.translate(toPx(b.x), toPx(b.z)); g.rotate(-b.rot); g.fillRect(-b.w / 2, -b.d / 2, b.w, b.d); g.strokeRect(-b.w / 2, -b.d / 2, b.w, b.d); g.restore();
    }
    g.fillStyle = '#c8b8d8'; g.beginPath(); g.arc(toPx(ARENA.x), toPx(ARENA.z), ARENA.r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#a8c8e8'; g.beginPath(); g.arc(toPx(ALTAR.x), toPx(ALTAR.z), ALTAR.r * S / SIZE, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#b08a4a'; g.fillRect(toPx(FARM.x - 13), toPx(FARM.z - 13), 26 * S / SIZE, 26 * S / SIZE);
    for (const o of OUTPOSTS) { g.fillStyle = '#ffd27a'; g.strokeStyle = '#4a2a10'; g.lineWidth = 1.5; g.beginPath(); g.arc(toPx(o.x), toPx(o.z), 4, 0, Math.PI * 2); g.fill(); g.stroke(); }
    g.fillStyle = '#b07a50';
    for (const b of BRIDGES) g.fillRect(toPx(b.x - b.len / 2), toPx(b.z - b.w / 2), b.len, b.w);
    for (const gt of this.gates || []) {
      g.fillStyle = '#7a3ac8'; g.strokeStyle = '#ffffff'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(toPx(gt.x), toPx(gt.z), 4.5, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    this.minimapCanvas = c;
    this.minimap = { canvas: c, minX: -HALF, minZ: -HALF, size: SIZE };
  }

  update(dt, t) {
    this.t = t;
    this.water.material.uniforms.uTime.value = t;
    for (const f of this.anim) f(t, dt);
    for (const c of this.clouds) { c.position.x += dt * 3; if (c.position.x > 1100) c.position.x = -1100; }
    for (const g of this.islands) { g.position.y = g.userData.base + Math.sin(t * 0.3 + g.userData.ph) * 3; g.rotation.y += dt * 0.02; }
  }
}

export function mulberry(a) {
  return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
