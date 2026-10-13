// Day and night, and weather by season, in the open world. One clock for every player: a day lasts DAY_MIN real
// minutes (sunrise near 05:00, sunset near 19:00) and the weather changes every WEATHER_MIN minutes, picked from the
// season's table (the real-world month) with a seed both players share, so friends see the same sky. Dungeons, trials
// and guild wars keep their own lighting. The weather is only a look and a sound: it never changes combat.
import * as THREE from 'three';
import { glowTexture } from './toon.js';

export const DAY_MIN = 40, WEATHER_MIN = 10;
const SUNRISE = 0.2, SUNSET = 0.8; // as a share of the day
// gloom darkens and greys the sky; fog pulls the far fog in (metres); fall is the particle kind
export const WEATHER = {
  clear: { name: 'Clear', icon: 'w_clear', gloom: 0 },
  cloudy: { name: 'Cloudy', icon: 'w_cloudy', gloom: 0.35, fog: 900 },
  rain: { name: 'Rain', icon: 'w_rain', gloom: 0.55, fog: 520, fall: 'rain', amount: 1 },
  storm: { name: 'Thunderstorm', icon: 'w_storm', gloom: 0.75, fog: 380, fall: 'rain', amount: 1.6, lightning: true },
  snow: { name: 'Snow', icon: 'w_snow', gloom: 0.3, fog: 650, fall: 'snow', amount: 1 },
  blizzard: { name: 'Blizzard', icon: 'w_snow', gloom: 0.55, fog: 260, fall: 'snow', amount: 2 },
  petals: { name: 'Blossom breeze', icon: 'w_petals', gloom: 0, fall: 'petals', amount: 1 },
  leaves: { name: 'Falling leaves', icon: 'w_leaves', gloom: 0.1, fall: 'leaves', amount: 1 },
};
export const SEASONS = [
  { name: 'Winter', months: [11, 0, 1], table: [['snow', 40], ['clear', 25], ['cloudy', 20], ['blizzard', 15]] },
  { name: 'Spring', months: [2, 3, 4], table: [['clear', 40], ['petals', 30], ['rain', 20], ['cloudy', 10]] },
  { name: 'Summer', months: [5, 6, 7], table: [['clear', 50], ['rain', 20], ['storm', 20], ['cloudy', 10]] },
  { name: 'Autumn', months: [8, 9, 10], table: [['clear', 35], ['leaves', 35], ['rain', 15], ['cloudy', 15]] },
];
export const seasonOf = (d = new Date()) => SEASONS.find((s) => s.months.includes(d.getMonth()));

// where the day is (0 = midnight), from the shared clock
export function dayPhase(now = Date.now()) { return (now / 60000 % DAY_MIN) / DAY_MIN; }
// the weather for a 10-minute slot: the same on every computer
export function weatherAt(now = Date.now()) {
  const slot = Math.floor(now / (WEATHER_MIN * 60000)), season = seasonOf(new Date(now));
  let x = (slot * 2654435761) >>> 0; x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d) >>> 0; x ^= x >>> 12;
  let r = (x % 1000) / 1000 * season.table.reduce((a, [, w]) => a + w, 0);
  for (const [k, w] of season.table) { if ((r -= w) < 0) return k; }
  return 'clear';
}
// the sun's height: 1 at noon, 0 at sunrise and sunset, below 0 at night
function sunHeight(p) {
  if (p >= SUNRISE && p <= SUNSET) return Math.sin(Math.PI * (p - SUNRISE) / (SUNSET - SUNRISE));
  const n = ((p - SUNSET + 1) % 1) / (1 - (SUNSET - SUNRISE));
  return -Math.sin(Math.PI * n) * 0.6;
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const C = (h) => new THREE.Color(h);
// sky gradient (top, middle, horizon), fog and light colours for day, twilight and night
const DAY = { top: C('#2f86e0'), mid: C('#8fd0ff'), bot: C('#e8f8ff'), fog: C('#cfeaff'), hemi: C('#e8f4ff'), ground: C('#6a8a4a'), sun: C('#fff2d8') };
const DUSK = { top: C('#4a5aa8'), mid: C('#f0a070'), bot: C('#ffd8a0'), fog: C('#e8b890'), hemi: C('#ffd0a8'), ground: C('#6a5a4a'), sun: C('#ffa060') };
const NIGHT = { top: C('#050a24'), mid: C('#1a2a5a'), bot: C('#2a3a6a'), fog: C('#1a2440'), hemi: C('#8aa0ff'), ground: C('#2a3a4a'), sun: C('#9ab8ff') };
const GREY = C('#8a96a6'), GREY_NIGHT = C('#20283a'), WHITE = C('#ffffff'), BLUSH = C('#ffd0b0');
const FALL_N = 1400, RAIN_N = 900, BOX = 46, TALL = 30;

const S = {
  skyInit() {
    const W = this.world, scene = this.scene;
    this.skyC = { top: new THREE.Color(), mid: new THREE.Color(), bot: new THREE.Color(), fog: new THREE.Color(), hemi: new THREE.Color(), ground: new THREE.Color(), sun: new THREE.Color() };
    this.skyLightDir = new THREE.Vector3(50, 70, 40);
    this.wx = { kind: weatherAt(), mix: 0, flash: 0, nextBolt: 4, thunderAt: 0 };
    this.wx.shown = this.wx.kind; this.wx.mix = 1;
    // stars and the moon
    const N = 900, sp = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u); sp[i * 3] = Math.cos(a) * r * 1300; sp[i * 3 + 1] = Math.abs(u) * 1300; sp[i * 3 + 2] = Math.sin(a) * r * 1300; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.stars.frustumCulled = false; W.root.add(this.stars);
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xdfe8ff, fog: false, depthWrite: false, transparent: true, opacity: 0 }));
    this.moon.scale.setScalar(190); W.root.add(this.moon);
    // falling snow, petals and leaves (one point cloud) and rain streaks (line segments), in a box that follows you
    const fp = new Float32Array(FALL_N * 3), fc = new Float32Array(FALL_N * 3);
    this.fallSeed = [];
    for (let i = 0; i < FALL_N; i++) { fp[i * 3] = (Math.random() - 0.5) * BOX * 2; fp[i * 3 + 1] = Math.random() * TALL; fp[i * 3 + 2] = (Math.random() - 0.5) * BOX * 2; this.fallSeed.push(Math.random() * 10); }
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fp, 3)); fg.setAttribute('color', new THREE.BufferAttribute(fc, 3));
    this.fall = new THREE.Points(fg, new THREE.PointsMaterial({ map: glowTexture(), size: 0.42, vertexColors: true, transparent: true, depthWrite: false, opacity: 0.95 }));
    this.fall.frustumCulled = false; this.fall.visible = false; scene.add(this.fall);
    const rp = new Float32Array(RAIN_N * 6);
    for (let i = 0; i < RAIN_N; i++) { const x = (Math.random() - 0.5) * BOX * 2, y = Math.random() * TALL, z = (Math.random() - 0.5) * BOX * 2; rp.set([x, y, z, x + 0.12, y + 1.1, z + 0.05], i * 6); }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xbcd4f0, transparent: true, opacity: 0.55, depthWrite: false }));
    this.rain.frustumCulled = false; this.rain.visible = false; scene.add(this.rain);
    this.fallKind = null;
    this.skyTmp = { sun: new THREE.Vector3(), cloud: new THREE.Color(), flash: C('#e8f0ff') };
  },
  // what the HUD shows: time, day or night, the weather and the season
  // the time of day and weather: the real clock, unless the Game Master set them (gm.js)
  skyPhase() { const t = this.S?.gm ? this.S.gmEdit?.time : null; return t != null ? t : dayPhase(); },
  skyInfo() {
    const p = this.skyPhase(), mins = Math.floor(p * 24 * 60), h = sunHeight(p);
    return { time: `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`, night: h < 0, weather: WEATHER[this.wxKindHere()], season: seasonOf(new Date(Date.now())).name };
  },
  // the weather where you stand: rain falls as snow in the frost highlands, and snow melts in the ember canyon
  wxKindHere() {
    const k = this.wx?.kind || 'clear', biome = this.zone?.biome;
    if (biome === 'frost' && (k === 'rain' || k === 'storm')) return k === 'storm' ? 'blizzard' : 'snow';
    if (biome === 'ember' && (k === 'snow' || k === 'blizzard' || k === 'petals' || k === 'leaves')) return 'clear';
    return k;
  },
  skyUpdate(dt) {
    if (!this.skyC) return;
    const outside = this.map === this.world && !this.dg && !this.trial && !this.war;
    const show = outside && this.S.settings.weather !== false;
    this.fall.visible = this.rain.visible = false;
    this.skyLit = outside; // the camera places the shadow light from skyLightDir only in the open world
    if (!outside) { this.stars.visible = this.moon.visible = false; return; }
    this.stars.visible = this.moon.visible = true;
    const W = this.world, L = this.lights, sc = this.scene, p = this.skyPhase(), e = sunHeight(p);
    const day = smooth(-0.1, 0.22, e), tw = Math.exp(-((e / 0.16) ** 2));
    // weather: a new slot fades in over ~20 s
    this.wx.kind = (this.S?.gm && WEATHER[this.S.gmEdit?.weather] && this.S.gmEdit.weather) || weatherAt();
    const here = this.wxKindHere();
    if (here !== this.wx.shown) { this.wx.mix -= dt / 10; if (this.wx.mix <= 0) { this.wx.shown = here; this.wx.mix = 0; } } else this.wx.mix = Math.min(1, this.wx.mix + dt / 10);
    const Wd = WEATHER[this.wx.shown], k = this.wx.mix, gloom = (Wd.gloom || 0) * k;
    // colours: night to day, a twilight blush near the horizon, greyed by gloom
    const c = this.skyC;
    for (const key of Object.keys(c)) {
      c[key].copy(NIGHT[key]).lerp(DAY[key], day).lerp(DUSK[key], tw * 0.75);
      if (key !== 'sun' && key !== 'ground') c[key].lerp(day > 0.5 ? GREY : GREY_NIGHT, gloom * (key === 'top' ? 0.6 : 0.75));
    }
    if (this.wx.flash > 0) { this.wx.flash = Math.max(0, this.wx.flash - dt * 4); for (const key of ['top', 'mid', 'bot', 'fog', 'hemi']) c[key].lerp(this.skyTmp.flash, this.wx.flash * 0.7); }
    const U = W.sky.material.uniforms;
    U.top.value.copy(c.top); U.mid.value.copy(c.mid); U.bot.value.copy(c.bot);
    this.skyFog = c.fog; // the Danger Zone tints from this
    sc.fog.color.copy(c.fog);
    sc.fog.near = 180 - 120 * gloom; sc.fog.far = Wd.fog ? 1500 + (Wd.fog - 1500) * k : 1500;
    L.hemi.color.copy(c.hemi); L.hemi.groundColor.copy(c.ground);
    L.hemi.intensity = (0.45 + 0.85 * day) * (1 - 0.25 * gloom) + this.wx.flash * 1.2;
    L.ambient.intensity = 0.22 + 0.23 * day + this.wx.flash * 0.6;
    this.sun.color.copy(c.sun);
    this.sun.intensity = (0.4 + 1.9 * day) * (1 - 0.6 * gloom); // moonlight 0.4 at night
    // the light that casts shadows: the sun by day (low and warm at its ends), the moon by night
    const t = (p - SUNRISE) / (SUNSET - SUNRISE), az = Math.PI * Math.min(1, Math.max(0, t));
    const elev = Math.max(0.42, e > 0 ? e : -e);
    if (e > 0) this.skyLightDir.set(Math.cos(az) * 80, 40 + elev * 60, 25 + Math.sin(az) * 30);
    else this.skyLightDir.set(-40, 75, -30);
    // the sun and moon in the sky, stars at night
    const sunPos = this.skyTmp.sun.set(Math.cos(az) * 900, Math.max(-300, e * 800), 300 + Math.sin(az) * 200);
    W.sunSprite.position.copy(sunPos); W.sunSprite.material.opacity = Math.min(1, Math.max(0, e * 4 + 0.2)) * (1 - 0.8 * gloom);
    this.moon.position.set(-sunPos.x * 0.8, Math.max(250, -e * 900), -sunPos.z * 0.8);
    this.moon.material.opacity = (1 - day) * (1 - 0.8 * gloom);
    this.stars.material.opacity = Math.max(0, 1 - day * 1.6) * (1 - gloom);
    const cloud = this.skyTmp.cloud.copy(NIGHT.mid).lerp(WHITE, day).lerp(BLUSH, tw * 0.5).lerp(GREY, gloom * 0.6);
    for (const cl of W.clouds) cl.material.color.copy(cloud);
    if (W.lampMat) W.lampMat.opacity = 0.25 + 0.75 * (1 - day);
    // lightning in a thunderstorm: a flash, then thunder a moment later
    if (Wd.lightning && k > 0.5) {
      if ((this.wx.nextBolt -= dt) <= 0) { this.wx.nextBolt = 6 + Math.random() * 10; this.wx.flash = 1; this.wx.thunderAt = this.time + 0.6 + Math.random() * 1.4; }
    }
    if (this.wx.thunderAt && this.time >= this.wx.thunderAt) { this.wx.thunderAt = 0; this.sfx.play('rumble'); }
    if (show) this.updateFall(dt, Wd, k);
  },
  // move the falling weather with you and animate it
  updateFall(dt, Wd, k) {
    const p = this.player.pos;
    if (Wd.fall === 'rain') {
      const R = this.rain, pos = R.geometry.attributes.position, a = pos.array, n = Math.round(RAIN_N * Math.min(1, 0.55 * Wd.amount) * k), sp = 26 + 8 * Wd.amount;
      R.visible = n > 0; R.position.set(p.x, p.y - 4, p.z); R.geometry.setDrawRange(0, n * 2);
      R.material.opacity = 0.35 + 0.25 * k;
      for (let i = 0; i < n; i++) { const o = i * 6; a[o + 1] -= sp * dt; a[o + 4] -= sp * dt; if (a[o + 1] < 0) { a[o + 1] += TALL; a[o + 4] += TALL; } }
      pos.needsUpdate = true;
      return;
    }
    if (!Wd.fall) return;
    const F = this.fall, pos = F.geometry.attributes.position, col = F.geometry.attributes.color, a = pos.array;
    if (this.fallKind !== Wd.fall) {
      this.fallKind = Wd.fall;
      const pal = { snow: [[1, 1, 1], [0.92, 0.96, 1]], petals: [[1, 0.72, 0.84], [1, 0.9, 0.95], [0.98, 0.6, 0.78]], leaves: [[0.95, 0.55, 0.15], [0.85, 0.3, 0.12], [0.95, 0.78, 0.25], [0.6, 0.35, 0.15]] }[Wd.fall];
      for (let i = 0; i < FALL_N; i++) col.array.set(pal[i % pal.length], i * 3);
      col.needsUpdate = true;
      F.material.size = Wd.fall === 'snow' ? 0.55 : 0.75;
    }
    const n = Math.round(FALL_N * Math.min(1, (Wd.fall === 'snow' ? 0.5 : 0.25) * Wd.amount) * k);
    F.visible = n > 0; F.position.set(p.x, p.y - 4, p.z); F.geometry.setDrawRange(0, n);
    const fallSp = Wd.fall === 'snow' ? 2.2 * Wd.amount : Wd.fall === 'petals' ? 1.4 : 1.8, drift = Wd.fall === 'snow' ? 0.6 : 1.6, t = this.time;
    for (let i = 0; i < n; i++) {
      const o = i * 3, s = this.fallSeed[i];
      a[o + 1] -= fallSp * dt * (0.7 + (s % 1) * 0.6);
      a[o] += (Math.sin(t * 0.9 + s) * drift + (Wd.amount > 1.5 ? 4 : 0.6)) * dt; // a blizzard blows sideways
      a[o + 2] += Math.cos(t * 0.7 + s * 1.3) * drift * dt;
      if (a[o + 1] < 0) a[o + 1] += TALL;
      if (a[o] > BOX) a[o] -= BOX * 2;
    }
    pos.needsUpdate = true;
  },
};

export function installSky(Game) { Object.assign(Game.prototype, S); }
