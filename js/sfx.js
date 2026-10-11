// Tiny WebAudio synth for UI/combat sounds and a gentle procedural town melody.
export class Sfx {
  constructor() { this.ctx = null; this.on = true; this.music = null; }
  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { this.ctx = null; }
      if (this.ctx) { this.master = this.ctx.createGain(); this.master.gain.value = 0.35; this.master.connect(this.ctx.destination); }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, delay = 0, attack = 0.005 } = {}) {
    const c = this.ctx; if (!c || !this.on) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur, { vol = 0.2, delay = 0, hp = 800 } = {}) {
    const c = this.ctx; if (!c || !this.on) return;
    const t = c.currentTime + delay;
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = c.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t);
  }
  play(name) {
    if (!this.ctx || !this.on) return;
    switch (name) {
      case 'click': this.tone(880, 0.06, { type: 'triangle', vol: 0.15 }); break;
      case 'hit': this.noise(0.08, { vol: 0.18, hp: 1500 }); this.tone(220, 0.08, { type: 'square', vol: 0.05, slide: -100 }); break;
      case 'crit': this.noise(0.14, { vol: 0.25, hp: 900 }); this.tone(520, 0.15, { type: 'sawtooth', vol: 0.06, slide: -300 }); break;
      case 'hurt': this.tone(160, 0.12, { type: 'square', vol: 0.06, slide: -60 }); break;
      case 'cast': this.tone(600, 0.25, { type: 'sine', vol: 0.12, slide: 500 }); this.tone(900, 0.2, { type: 'triangle', vol: 0.06, delay: 0.05, slide: 400 }); break;
      case 'boom': this.noise(0.4, { vol: 0.3, hp: 200 }); this.tone(90, 0.4, { type: 'sine', vol: 0.25, slide: -50 }); break;
      case 'coin': this.tone(1320, 0.07, { type: 'square', vol: 0.05 }); this.tone(1760, 0.12, { type: 'square', vol: 0.05, delay: 0.07 }); break;
      case 'level': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.35, { type: 'triangle', vol: 0.18, delay: i * 0.11 })); break;
      case 'quest': [784, 988, 1175].forEach((f, i) => this.tone(f, 0.25, { type: 'sine', vol: 0.15, delay: i * 0.09 })); break;
      case 'heal': [660, 880, 1100].forEach((f, i) => this.tone(f, 0.3, { type: 'sine', vol: 0.1, delay: i * 0.06 })); break;
      case 'mount': this.tone(400, 0.3, { type: 'triangle', vol: 0.12, slide: 400 }); break;
      case 'error': this.tone(200, 0.15, { type: 'square', vol: 0.06 }); break;
      case 'pickup': this.tone(990, 0.06, { type: 'triangle', vol: 0.1 }); this.tone(1320, 0.08, { type: 'triangle', vol: 0.08, delay: 0.05 }); break;
      case 'rare': [880, 1175, 1568].forEach((f, i) => this.tone(f, 0.22, { type: 'triangle', vol: 0.1, delay: i * 0.06 })); break;
      case 'legend': [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.5, { type: 'triangle', vol: 0.16, delay: i * 0.09 })); this.tone(262, 1.2, { type: 'sine', vol: 0.12, attack: 0.05 }); break;
      case 'door': this.tone(300, 0.6, { type: 'sine', vol: 0.15, slide: 600 }); this.noise(0.5, { vol: 0.08, hp: 2000 }); break;
      case 'chest': this.noise(0.2, { vol: 0.12, hp: 600 }); [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.12, delay: 0.15 + i * 0.07 })); break;
      case 'open': this.tone(700, 0.08, { type: 'triangle', vol: 0.1 }); this.tone(1050, 0.1, { type: 'triangle', vol: 0.08, delay: 0.05 }); break;
    }
  }
  startMusic() {
    if (!this.ensure() || this.music) return;
    const prog = [[261.6, 329.6, 392.0], [196.0, 246.9, 293.7], [220.0, 261.6, 329.6], [174.6, 220.0, 261.6]];
    const mel = [0, 1, 2, 1, 2, 3, 2, 1];
    let step = 0;
    const tick = () => {
      if (!this.on) { step++; return; }
      const chord = prog[Math.floor(step / 8) % 4];
      const i = mel[step % 8];
      const f = i === 3 ? chord[0] * 2 : chord[i];
      this.tone(f * 2, 0.5, { type: 'triangle', vol: 0.045, attack: 0.02 });
      if (step % 8 === 0) chord.forEach((cf) => this.tone(cf, 2.6, { type: 'sine', vol: 0.03, attack: 0.4 }));
      if (step % 4 === 2 && Math.random() < 0.5) this.tone(chord[2] * 4, 0.3, { type: 'sine', vol: 0.02, delay: 0.15 });
      step++;
    };
    this.music = setInterval(tick, 330);
  }
}
