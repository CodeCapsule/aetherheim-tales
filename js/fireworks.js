// Fireworks: Fireworks and Grand Fireworks from Hilda's shop (or the Star Wish) launch rockets that burst in the sky;
// everyone nearby sees them (sent over the Realtime channel). Every in-game midnight a short show lights up the sky
// over Sylvan Haven for whoever is in town, and a hero's 10th, 20th, 30th ... level goes up with a rocket too.
import * as THREE from 'three';
import { glowTexture } from './toon.js';
import { mp } from './mp.js';

const PALETTES = [
  [0xff4a5a, 0xffd0d8, 0xffffff], [0xffd84a, 0xfff2b0, 0xff9a2a], [0x5ad8ff, 0xd8f6ff, 0xffffff], [0x7aff8a, 0xe0ffe0, 0xfff6a0],
  [0xc88aff, 0xf0e0ff, 0xff9ae8], [0xff8a3a, 0xffe0a0, 0xff4a2a], [0xffffff, 0xd8e8ff, 0xffd84a],
];
const num = (v, lo, hi, d = 0) => { v = +v; return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

const G = {
  // one rocket from (x, z): rises, then bursts; big ones burst twice as wide with a crackling second ring
  firework(x, z, pal = (Math.random() * PALETTES.length) | 0, big = false, quiet = false) {
    const fx = this.fx, y0 = this.map.heightAt(x, z), top = y0 + (big ? 26 : 18) + Math.random() * 4, cols = PALETTES[pal % PALETTES.length];
    const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: cols[0], blending: THREE.AdditiveBlending, depthWrite: false }));
    core.scale.setScalar(1.4); core.position.set(x, y0 + 1, z);
    const rise = 1.1, drift = (Math.random() - 0.5) * 3;
    let t = 0;
    if (!quiet) this.sfx.play('swish');
    fx.add(core, rise, () => {
      t += fx._dt || 0.016;
      const k = Math.min(1, t / rise);
      core.position.set(x + drift * k, y0 + 1 + (top - y0 - 1) * (1 - (1 - k) * (1 - k)), z);
      fx.emit(core.position, { count: 2, colors: [0xffe0a0, 0xffffff], speed: 0.5, life: 0.5, size: 0.35, gravity: -2 });
    }, () => {
      const at = core.position.clone();
      core.material.dispose();
      fx.emit(at, { count: big ? 220 : 130, colors: cols, speed: big ? 16 : 11, life: big ? 2.2 : 1.7, size: big ? 0.9 : 0.7, gravity: -5, drag: 1.1 });
      fx.emit(at, { count: 30, color: 0xffffff, speed: 3, life: 0.4, size: 1.6 });
      if (big) this.after(0.35, () => fx.emit(at, { count: 120, colors: [cols[1], 0xffffff], speed: 7, life: 1.2, size: 0.45, gravity: -3, jitter: 6 }));
      if (!quiet && flat(at, this.player.pos) < 90) this.sfx.play('boom');
    });
  },
  // from the bag; sends the launch to everyone around
  useFirework(id) {
    const p = this.player, big = id === 'firework_grand';
    if (this.dg || this.trial || this.war) { this.ui.toast('Save the fireworks for the open sky', 'warn'); return false; }
    this.removeItem(id, 1);
    const shots = big ? 5 : 1;
    for (let i = 0; i < shots; i++) {
      const a = Math.random() * Math.PI * 2, r = big ? 2 + Math.random() * 6 : 0;
      const x = p.pos.x + Math.sin(a) * r, z = p.pos.z + Math.cos(a) * r, pal = (Math.random() * PALETTES.length) | 0;
      this.after(i * 0.45, () => { this.firework(x, z, pal, big); this.fwSend(x, z, pal, big); });
    }
    this.track && this.track('firework');
    return true;
  },
  fwSend(x, z, pal, big) {
    if (mp.status !== 'online' || !mp.channel || this.map !== this.world) return;
    mp.channel.send({ type: 'broadcast', event: 'x', payload: { i: mp.id, k: 'fw', x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, c: pal, b: big ? 1 : 0 } }).catch(() => {});
  },
  // a launch from someone else (only drawn when it is in sight)
  fwMsg(m) {
    if (!m || m.k !== 'fw' || this.map !== this.world || this.dg) return;
    const x = num(m.x, -400, 400), z = num(m.z, -400, 400);
    if (Math.hypot(x - this.player.pos.x, z - this.player.pos.z) > 150) return;
    this.firework(x, z, num(m.c, 0, PALETTES.length - 1) | 0, !!m.b);
  },
  // the nightly show over Sylvan Haven: the first 12 in-game minutes after midnight (20 seconds), the same moment for everyone
  fwUpdate(dt) {
    if (this.map !== this.world || this.dg || this.trial) return;
    const sk = this.skyInfo ? this.skyInfo() : null; if (!sk) return;
    const show = /^00:(0\d|1[01])$/.test(sk.time) && Math.hypot(this.player.pos.x, this.player.pos.z) < 120;
    if (!show) { this.fwShowT = 0; return; }
    this.fwShowT = (this.fwShowT || 0) - dt;
    if (this.fwShowT > 0) return;
    this.fwShowT = 0.7 + Math.random() * 0.8;
    const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 18;
    this.firework(Math.sin(a) * r, Math.cos(a) * r, (Math.random() * PALETTES.length) | 0, Math.random() < 0.25, true);
    if (!this.fwShowSaid) { this.fwShowSaid = true; this.ui.chat('system', 'Fireworks over Sylvan Haven: midnight has come!'); setTimeout(() => { this.fwShowSaid = false; }, 120000); }
  },
  fwLevel() { const p = this.player; this.firework(p.pos.x + 2, p.pos.z, (Math.random() * PALETTES.length) | 0, true); },
};

export function installFireworks(Game) { Object.assign(Game.prototype, G); }
