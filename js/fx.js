// Visual effects: GPU particle pool, skill effects, projectiles, telegraphs and floating combat text.
import * as THREE from 'three';
import { glowTexture, magicCircleTexture, ringTexture, targetRingTexture, beamTexture } from './toon.js';

const MAXP = 4000;

export class FX {
  constructor(scene, camera, layer) {
    this.scene = scene; this.camera = camera; this.layer = layer;
    this.effects = []; this.texts = []; this.shakeAmt = 0;
    // particle pool
    this.pPos = new Float32Array(MAXP * 3); this.pCol = new Float32Array(MAXP * 3);
    this.pSize = new Float32Array(MAXP); this.pAlpha = new Float32Array(MAXP);
    this.pVel = new Float32Array(MAXP * 3); this.pLife = new Float32Array(MAXP); this.pMax = new Float32Array(MAXP);
    this.pGrav = new Float32Array(MAXP); this.pSize0 = new Float32Array(MAXP); this.pDrag = new Float32Array(MAXP);
    this.pNext = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.pSize, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.pAlpha, 1));
    this.pUniforms = { map: { value: glowTexture() }, uPx: { value: 600 } };
    const m = new THREE.ShaderMaterial({
      uniforms: this.pUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float uPx;\nvoid main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * uPx / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform sampler2D map; varying vec3 vC; varying float vA;\nvoid main(){ vec4 t = texture2D(map, gl_PointCoord); if (vA <= 0.0) discard; gl_FragColor = vec4(vC * t.rgb, t.a * vA); }',
    });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false; this.points.renderOrder = 10;
    scene.add(this.points);
    this.geo = {
      arc: new THREE.TorusGeometry(1, 0.1, 4, 28, Math.PI * 1.1),
      ring: new THREE.RingGeometry(0.85, 1, 48),
      disc: new THREE.CircleGeometry(1, 48),
      cyl: new THREE.CylinderGeometry(1, 1, 1, 24, 1, true),
      sph: new THREE.SphereGeometry(1, 16, 12),
      coin: new THREE.CylinderGeometry(0.18, 0.18, 0.05, 12),
      rock: new THREE.DodecahedronGeometry(0.5, 0),
      bubble: new THREE.SphereGeometry(1, 20, 16),
    };
  }

  setViewport(h) { this.pUniforms.uPx.value = h / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2)); }

  emit(p, { count = 20, color = 0xffffff, speed = 4, life = 0.8, size = 0.6, gravity = 0, spread = 1, up = 0, drag = 0, jitter = 0, colors } = {}) {
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const k = this.pNext; this.pNext = (this.pNext + 1) % MAXP;
      c.set(colors ? colors[i % colors.length] : color);
      this.pPos[k * 3] = p.x + (Math.random() - 0.5) * jitter; this.pPos[k * 3 + 1] = p.y + (Math.random() - 0.5) * jitter; this.pPos[k * 3 + 2] = p.z + (Math.random() - 0.5) * jitter;
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      const s = speed * (0.4 + Math.random() * 0.6);
      this.pVel[k * 3] = Math.sin(ph) * Math.cos(th) * s * spread;
      this.pVel[k * 3 + 1] = Math.cos(ph) * s * spread + up;
      this.pVel[k * 3 + 2] = Math.sin(ph) * Math.sin(th) * s * spread;
      this.pCol[k * 3] = c.r; this.pCol[k * 3 + 1] = c.g; this.pCol[k * 3 + 2] = c.b;
      this.pLife[k] = this.pMax[k] = life * (0.6 + Math.random() * 0.4);
      this.pSize0[k] = size * (0.6 + Math.random() * 0.7); this.pGrav[k] = gravity; this.pDrag[k] = drag;
    }
  }

  add(obj, life, update, onEnd) {
    if (obj) this.scene.add(obj);
    const e = { obj, life, max: life, update, onEnd };
    this.effects.push(e);
    return e;
  }
  basic(color, opts = {}) { return new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, ...opts }); }

  // ------------------------------------------------------------ effects
  slash(pos, yaw, color = 0xffffff, radius = 1.6, tilt = 0, dur = 0.28) {
    const m = new THREE.Mesh(this.geo.arc, this.basic(color));
    m.position.copy(pos); m.position.y += 1.0;
    m.rotation.set(Math.PI / 2 + tilt, 0, 0);
    const holder = new THREE.Group(); holder.add(m); holder.position.copy(m.position); m.position.set(0, 0, 0); holder.rotation.y = yaw - Math.PI * 0.55;
    m.scale.setScalar(radius);
    this.add(holder, dur, (k) => { holder.rotation.y = yaw - Math.PI * 0.55 + (1 - k) * 1.4; m.material.opacity = k; m.scale.setScalar(radius * (1.2 - k * 0.2)); }, () => m.material.dispose());
    const fw = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(radius * 0.8);
    this.emit(pos.clone().add(fw).setY(pos.y + 1), { count: 10, color, speed: 3, life: 0.35, size: 0.35 });
  }

  spin(pos, color, radius) {
    for (let i = 0; i < 3; i++) setTimeout(() => this.slash(pos, i * 2.1, color, radius * 0.8, 0, 0.3), i * 90);
    this.ring(pos, color, radius, 0.45);
  }

  ring(pos, color = 0xffffff, radius = 4, dur = 0.5, y = 0.15) {
    const m = new THREE.Mesh(this.geo.ring, this.basic(color));
    m.rotation.x = -Math.PI / 2; m.position.copy(pos); m.position.y += y;
    this.add(m, dur, (k) => { const s = radius * (1.05 - k * 0.9 + 0.05); m.scale.setScalar(Math.max(0.1, radius * (1 - k) + 0.3)); m.material.opacity = k; }, () => m.material.dispose());
  }

  circle(pos, color = '#ffd36b', radius = 2.5, dur = 1.2, follow = null) {
    const m = new THREE.Mesh(this.geo.disc, this.basic(0xffffff, { map: magicCircleTexture(color) }));
    m.rotation.x = -Math.PI / 2; m.position.copy(pos); m.position.y += 0.12; m.scale.setScalar(radius);
    this.add(m, dur, (k) => {
      if (follow) { m.position.x = follow.position.x; m.position.z = follow.position.z; m.position.y = follow.position.y + 0.12; }
      m.rotation.z += 0.03; m.material.opacity = Math.min(1, k * 3) * Math.min(1, (1 - k) * 6 + 0.2);
      m.scale.setScalar(radius * (k > 0.85 ? (1 - k) / 0.15 * 0.3 + 0.7 : 1));
    }, () => m.material.dispose());
    return m;
  }

  pillar(pos, color = 0xff7a2a, radius = 2, height = 8, dur = 0.8) {
    const beam = beamTexture();
    const m = new THREE.Mesh(this.geo.cyl, this.basic(color, { opacity: 0.75, map: beam }));
    m.position.copy(pos);
    const grow = (mesh, r, hgt, k, a) => { const p = 1 - k; const hh = hgt * Math.min(1, p * 4); mesh.scale.set(r, hh, r); mesh.position.y = pos.y + hh / 2; mesh.material.opacity = Math.min(1, k * 2.5) * a; };
    this.add(m, dur, (k) => grow(m, radius * (0.5 + (1 - k) * 0.7), height, k, 0.75), () => m.material.dispose());
    const inner = new THREE.Mesh(this.geo.cyl, this.basic(new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.6).getHex(), { opacity: 0.4, map: beam }));
    inner.position.copy(pos);
    this.add(inner, dur * 0.8, (k) => grow(inner, radius * 0.3, height * 1.1, k, 0.4), () => inner.material.dispose());
  }

  bubble(target, dur = 3) {
    const m = new THREE.Mesh(this.geo.bubble, new THREE.MeshBasicMaterial({ color: 0x8ad8ff, transparent: true, opacity: 0.35, depthWrite: false }));
    const h = target.height || 2;
    this.add(m, dur, (k) => { m.position.copy(target.pos); m.position.y += h * 0.5; m.scale.setScalar(h * 0.7 * (1 + Math.sin(k * 30) * 0.03)); m.material.opacity = 0.35 * Math.min(1, k * 4); }, () => m.material.dispose());
  }

  projectile(from, target, { color = 0xff7a2a, speed = 26, size = 0.35, trail = true, onHit } = {}) {
    const core = new THREE.Mesh(this.geo.sph, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    core.scale.setScalar(size * 0.6);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(size * 4.5); core.add(halo); halo.scale.divideScalar(size * 0.6);
    core.position.copy(from);
    const e = this.add(core, 6, () => {
      const tp = target.pos.clone(); tp.y += (target.height || 2) * 0.55;
      const d = tp.clone().sub(core.position); const L = d.length();
      const step = speed * this._dt;
      if (L <= step || target.dead) { e.life = 0; if (!target.dead && onHit) onHit(); this.emit(core.position, { count: 18, color, speed: 5, life: 0.4, size: size * 1.4 }); return; }
      core.position.addScaledVector(d.normalize(), step);
      if (trail) this.emit(core.position, { count: 2, color, speed: 0.6, life: 0.35, size: size * 1.6 });
    }, () => { core.material.dispose(); halo.material.dispose(); });
  }

  meteor(pos, color = 0xff7a2a, dur = 0.8, onImpact) {
    const m = new THREE.Mesh(this.geo.sph, new THREE.MeshBasicMaterial({ color: 0xffd08a }));
    m.scale.setScalar(1.2);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(6 / 1.2); m.add(halo);
    const start = pos.clone().add(new THREE.Vector3(-8, 26, -8));
    this.circle(pos, '#ff8a3a', 4, dur + 0.3);
    this.add(m, dur, (k) => {
      m.position.lerpVectors(pos, start, k);
      this.emit(m.position, { count: 4, colors: [0xff6a2a, 0xffc04a, 0xff3a1a], speed: 1, life: 0.5, size: 1.4 });
    }, () => {
      m.material.dispose(); halo.material.dispose();
      this.emit(pos.clone().setY(pos.y + 0.5), { count: 70, colors: [0xff6a2a, 0xffd04a, 0xff3a1a, 0xffffff], speed: 12, life: 0.7, size: 1.2, gravity: -10, up: 3 });
      this.ring(pos, 0xff8a3a, 7, 0.5);
      this.shake(0.5);
      onImpact && onImpact();
    });
  }

  quake(pos, radius = 6) {
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * radius * 0.8;
      const rock = new THREE.Mesh(this.geo.rock, new THREE.MeshToonMaterial({ color: 0x9a7a5a }));
      const p = pos.clone().add(new THREE.Vector3(Math.cos(a) * r, -0.6, Math.sin(a) * r));
      rock.position.copy(p); rock.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      const s = 0.8 + Math.random() * 1.0;
      this.add(rock, 0.9, (k) => { const u = 1 - k; rock.position.y = p.y + Math.sin(Math.min(1, u * 3) * Math.PI / 2) * 1.4 - (u > 0.6 ? (u - 0.6) * 4 : 0); rock.scale.setScalar(s * Math.min(1, k * 4)); }, () => rock.material.dispose());
    }
    this.ring(pos, 0xe0b040, radius, 0.5);
    this.emit(pos, { count: 40, color: 0xc8a070, speed: 6, life: 0.7, size: 1.2, gravity: -12, up: 4 });
    this.shake(0.4);
  }

  telegraph(pos, radius, dur, onDone) {
    const outer = new THREE.Mesh(this.geo.disc, new THREE.MeshBasicMaterial({ map: ringTexture('#ff2a2a', 0.86), transparent: true, depthWrite: false }));
    const fill = new THREE.Mesh(this.geo.disc, new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.32, depthWrite: false }));
    for (const m of [outer, fill]) { m.rotation.x = -Math.PI / 2; m.position.copy(pos); m.renderOrder = 3; }
    outer.position.y += 0.18; fill.position.y += 0.16;
    outer.scale.setScalar(radius);
    this.add(fill, dur, (k) => { fill.scale.setScalar(Math.max(0.01, radius * (1 - k))); }, () => fill.material.dispose());
    this.add(outer, dur, (k) => { outer.material.opacity = 0.6 + Math.sin(k * 40) * 0.3; }, () => { outer.material.dispose(); onDone && onDone(); });
  }

  heal(ent) {
    const p = ent.pos;
    this.emit(p.clone().setY(p.y + 0.3), { count: 40, colors: [0x7aff9a, 0xffffff, 0xb8ffc8], speed: 1.2, life: 1.1, size: 0.55, up: 3.5, jitter: 1.6 });
    this.circle(p, '#7affa0', 2.0, 1.0, ent.model);
  }

  buff(ent, color = '#ffd36b') {
    this.circle(ent.pos, color, 2.4, 1.4, ent.model);
    this.emit(ent.pos.clone().setY(ent.pos.y + 0.5), { count: 30, color, speed: 0.8, life: 1.2, size: 0.5, up: 3, jitter: 1.5 });
    this.ring(ent.pos, new THREE.Color(color).getHex(), 3, 0.6);
  }

  levelUp(ent) {
    this.pillar(ent.pos, 0xffd84a, 1.8, 14, 1.4);
    this.circle(ent.pos, '#ffe07a', 3.2, 2.0, ent.model);
    this.ring(ent.pos, 0xffe07a, 6, 0.8);
    this.emit(ent.pos.clone().setY(ent.pos.y + 0.5), { count: 90, colors: [0xffe07a, 0xffffff, 0xffb84a], speed: 2, life: 1.8, size: 0.6, up: 5, jitter: 2 });
  }

  spawnPuff(pos, color = 0xffffff) {
    this.emit(pos.clone().setY(pos.y + 0.8), { count: 26, color, speed: 3, life: 0.6, size: 1.1, up: 1 });
  }

  coins(from, to, n, onArrive) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.geo.coin, new THREE.MeshBasicMaterial({ color: 0xffd84a }));
      const off = new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2);
      const a = from.clone().add(off).setY(from.y + 0.5);
      const delay = 0.35 + i * 0.05;
      let first = true;
      this.add(m, 0.6 + delay, (k) => {
        const t = 1 - k, total = 0.6 + delay;
        const el = t * total;
        if (el < delay) { m.position.copy(a); m.position.y += Math.sin(el / delay * Math.PI) * 1.2; m.rotation.x += 0.3; return; }
        const u = (el - delay) / 0.6;
        const b = to.pos.clone().setY(to.pos.y + 1.2);
        m.position.lerpVectors(a, b, u); m.position.y += Math.sin(u * Math.PI) * 2; m.rotation.y += 0.4;
      }, () => { m.material.dispose(); if (first && i === n - 1) { first = false; onArrive && onArrive(); } });
    }
  }

  clickMarker(pos) {
    const m = new THREE.Mesh(this.geo.disc, new THREE.MeshBasicMaterial({ map: targetRingTexture('#7aff7a'), transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.copy(pos); m.position.y += 0.15;
    this.add(m, 0.55, (k) => { m.scale.setScalar(0.4 + k * 1.0); m.material.opacity = k; m.rotation.z += 0.1; }, () => m.material.dispose());
  }

  // Jagged lightning arc between two points.
  bolt(a, b, color = 0x9ad8ff, dur = 0.28) {
    const g = new THREE.Group();
    const mat = this.basic(color, { opacity: 1 });
    const core = this.basic(0xffffff, { opacity: 1 });
    const n = 7, pts = [a.clone()];
    for (let i = 1; i < n; i++) {
      const p = a.clone().lerp(b, i / n);
      p.x += (Math.random() - 0.5) * 1.1; p.y += (Math.random() - 0.5) * 0.9; p.z += (Math.random() - 0.5) * 1.1;
      pts.push(p);
    }
    pts.push(b.clone());
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i], p1 = pts[i + 1], len = p0.distanceTo(p1);
      for (const [m, r] of [[mat, 0.12], [core, 0.045]]) {
        const seg = new THREE.Mesh(this.geo.cyl, m);
        seg.scale.set(r, len, r);
        seg.position.copy(p0).lerp(p1, 0.5);
        seg.quaternion.setFromUnitVectors(up, p1.clone().sub(p0).normalize());
        g.add(seg);
      }
    }
    this.emit(b, { count: 14, color, speed: 4, life: 0.35, size: 0.5 });
    this.add(g, dur, (k) => { mat.opacity = k; core.opacity = k; }, () => { mat.dispose(); core.dispose(); });
  }

  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }

  // ------------------------------------------------------------ floating text
  text(worldPos, str, cls = 'dmg', yOff = 0) {
    const el = document.createElement('div');
    el.className = 'ftxt ' + cls; el.textContent = str;
    this.layer.appendChild(el);
    const life = cls.includes('crit') ? 1.3 : 1.05;
    this.texts.push({ el, p: worldPos.clone().setY(worldPos.y + yOff), life, max: life, dx: (Math.random() - 0.5) * 40 });
  }

  update(dt, viewW, viewH) {
    this._dt = dt;
    // particles
    for (let k = 0; k < MAXP; k++) {
      if (this.pLife[k] <= 0) { this.pAlpha[k] = 0; continue; }
      this.pLife[k] -= dt;
      const f = Math.max(0, this.pLife[k] / this.pMax[k]);
      this.pVel[k * 3 + 1] += this.pGrav[k] * dt;
      if (this.pDrag[k]) { const d = 1 - this.pDrag[k] * dt; this.pVel[k * 3] *= d; this.pVel[k * 3 + 1] *= d; this.pVel[k * 3 + 2] *= d; }
      this.pPos[k * 3] += this.pVel[k * 3] * dt; this.pPos[k * 3 + 1] += this.pVel[k * 3 + 1] * dt; this.pPos[k * 3 + 2] += this.pVel[k * 3 + 2] * dt;
      this.pAlpha[k] = f; this.pSize[k] = this.pSize0[k] * (0.3 + f * 0.7);
    }
    const ga = this.points.geometry.attributes;
    ga.position.needsUpdate = ga.color.needsUpdate = ga.size.needsUpdate = ga.alpha.needsUpdate = true;
    // effects
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.life -= dt;
      const k = Math.max(0, e.life / e.max);
      if (e.update) e.update(k);
      if (e.life <= 0) { if (e.obj) this.scene.remove(e.obj); this.effects.splice(i, 1); e.onEnd && e.onEnd(); }
    }
    // texts
    const v = new THREE.Vector3();
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i]; t.life -= dt;
      if (t.life <= 0) { t.el.remove(); this.texts.splice(i, 1); continue; }
      v.copy(t.p).project(this.camera);
      if (v.z > 1) { t.el.style.opacity = 0; continue; }
      const u = 1 - t.life / t.max;
      const x = (v.x * 0.5 + 0.5) * viewW + t.dx * u, y = (-v.y * 0.5 + 0.5) * viewH - u * 70;
      const sc = u < 0.12 ? 0.6 + u / 0.12 * 0.9 : u < 0.25 ? 1.5 - (u - 0.12) / 0.13 * 0.5 : 1;
      t.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${sc})`;
      t.el.style.opacity = u > 0.7 ? (1 - u) / 0.3 : 1;
    }
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 1.5);
  }
}
