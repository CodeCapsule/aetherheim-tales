// Cel-shaded materials, ink outlines and procedural canvas textures.
import * as THREE from 'three';

let gradientMap = null;
export function getGradient() {
  if (!gradientMap) {
    const data = new Uint8Array([120, 120, 185, 255]);
    gradientMap = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
    gradientMap.minFilter = THREE.NearestFilter;
    gradientMap.magFilter = THREE.NearestFilter;
    gradientMap.generateMipmaps = false;
    gradientMap.needsUpdate = true;
  }
  return gradientMap;
}

const toonCache = new Map();
export function toon(color, opts = {}) {
  const key = color + '|' + JSON.stringify(opts);
  if (toonCache.has(key)) return toonCache.get(key);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: getGradient(), ...opts });
  toonCache.set(key, m);
  return m;
}

const basicCache = new Map();
export function glow(color, opacity = 1, additive = false) {
  const key = color + '|' + opacity + '|' + additive;
  if (basicCache.has(key)) return basicCache.get(key);
  const m = new THREE.MeshBasicMaterial({
    color, transparent: opacity < 1 || additive, opacity,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: !additive && opacity >= 1,
  });
  basicCache.set(key, m);
  return m;
}

const outlineCache = new Map();
export function outlineMaterial(thickness = 0.03, color = 0x2a1c18) {
  const key = thickness + '|' + color;
  if (outlineCache.has(key)) return outlineCache.get(key);
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.userData.thick = { value: thickness };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.outlineThick = m.userData.thick;
    shader.vertexShader = 'uniform float outlineThick;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\ntransformed += normal * outlineThick;'
    );
  };
  outlineCache.set(key, m);
  return m;
}

// Adds an ink outline (inverted hull) as a child sharing the geometry.
export function outline(mesh, thickness = 0.03, color) {
  const o = new THREE.Mesh(mesh.geometry, outlineMaterial(thickness, color));
  o.raycast = () => {};
  o.userData.isOutline = true;
  mesh.add(o);
  return mesh;
}

export function mesh(geo, color, { outlineW = 0.03, opts, cast = false } = {}) {
  const m = new THREE.Mesh(geo, typeof color === 'object' && color.isMaterial ? color : toon(color, opts));
  if (outlineW > 0) outline(m, outlineW);
  m.castShadow = cast;
  return m;
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function tex(c, { repeat = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}

const faceCache = new Map();
// Anime face texture, drawn onto the front patch of a head sphere.
export function faceTexture({ eye = '#3a6fd8', gender = 'f', mood = 'normal', blush = true, brow = '#5a3a2a' } = {}) {
  const key = [eye, gender, mood, blush, brow].join('|');
  if (faceCache.has(key)) return faceCache.get(key);
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  const cx = 128;
  const eyeY = 132, dx = 46;
  if (mood === 'closed') {
    g.strokeStyle = '#2a1a14'; g.lineWidth = 7; g.lineCap = 'round';
    for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * dx, eyeY - 4, 18, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
  } else if (mood === 'angry') {
    for (const s of [-1, 1]) {
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(cx + s * dx, eyeY, 20, 22, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = eye; g.beginPath(); g.ellipse(cx + s * dx, eyeY + 2, 13, 17, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(cx + s * dx - 4, eyeY - 6, 5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#2a1a14'; g.lineWidth = 8; g.lineCap = 'round';
      g.beginPath(); g.moveTo(cx + s * (dx + 22), eyeY - 30); g.lineTo(cx + s * (dx - 20), eyeY - 18); g.stroke();
    }
  } else {
    for (const s of [-1, 1]) {
      const x = cx + s * dx;
      // sclera
      g.fillStyle = '#ffffff';
      g.beginPath(); g.ellipse(x, eyeY, 21, 27, 0, 0, Math.PI * 2); g.fill();
      // iris gradient
      const gr = g.createLinearGradient(0, eyeY - 26, 0, eyeY + 26);
      gr.addColorStop(0, '#1a1030'); gr.addColorStop(0.45, eye); gr.addColorStop(1, lighten(eye, 0.55));
      g.fillStyle = gr;
      g.beginPath(); g.ellipse(x, eyeY + 2, 16, 23, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#120a1e';
      g.beginPath(); g.ellipse(x, eyeY + 2, 7, 11, 0, 0, Math.PI * 2); g.fill();
      // highlights
      g.fillStyle = '#ffffff';
      g.beginPath(); g.ellipse(x - s * 5 - 3, eyeY - 9, 7, 8, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(x + 6, eyeY + 12, 3.5, 0, Math.PI * 2); g.fill();
      // upper lash line
      g.strokeStyle = '#1e120e'; g.lineWidth = gender === 'f' ? 8 : 6; g.lineCap = 'round';
      g.beginPath(); g.ellipse(x, eyeY + 4, 22, 30, 0, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
      if (gender === 'f') {
        g.lineWidth = 5;
        g.beginPath(); g.moveTo(x + s * 20, eyeY - 14); g.lineTo(x + s * 30, eyeY - 22); g.stroke();
      }
      // brows
      g.strokeStyle = brow; g.lineWidth = 5;
      g.beginPath(); g.moveTo(x - 14, eyeY - 40 + (s > 0 ? 0 : 0)); g.quadraticCurveTo(x, eyeY - 46, x + 14, eyeY - 40); g.stroke();
    }
  }
  if (blush) {
    g.fillStyle = 'rgba(255,120,140,0.45)';
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + s * 70, eyeY + 32, 17, 9, 0, 0, Math.PI * 2); g.fill(); }
  }
  // mouth
  g.strokeStyle = '#7a2a2a'; g.lineWidth = 5; g.lineCap = 'round';
  g.beginPath();
  if (mood === 'angry') { g.moveTo(cx - 10, eyeY + 50); g.lineTo(cx + 10, eyeY + 48); }
  else { g.arc(cx, eyeY + 40, 9, 0.2 * Math.PI, 0.8 * Math.PI); }
  g.stroke();
  const t = tex(c);
  faceCache.set(key, t);
  return t;
}

// Simple creature face (dot eyes) for monsters & pets.
export function critterFace({ eye = '#1a1020', mood = 'happy', blush = true, mouth = 'smile', eyeSize = 1, patches = false } = {}) {
  const key = 'c|' + [eye, mood, blush, mouth, eyeSize, patches].join('|');
  if (faceCache.has(key)) return faceCache.get(key);
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  const cx = 128, ey = 120, dx = 42;
  if (patches) {
    g.fillStyle = '#26262c';
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + s * (dx + 4), ey + 4, 26, 32, s * -0.5, 0, Math.PI * 2); g.fill(); }
  }
  for (const s of [-1, 1]) {
    const x = cx + s * dx;
    if (mood === 'angry') {
      g.fillStyle = eye; g.beginPath(); g.ellipse(x, ey, 15 * eyeSize, 18 * eyeSize, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x - 4, ey - 6, 5 * eyeSize, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#1a1020'; g.lineWidth = 8; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x + s * 24, ey - 30); g.lineTo(x - s * 14, ey - 18); g.stroke();
    } else if (mood === 'sleepy') {
      g.strokeStyle = eye; g.lineWidth = 7; g.lineCap = 'round';
      g.beginPath(); g.arc(x, ey, 14, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke();
    } else if (mood === 'glow') {
      const gr = g.createRadialGradient(x, ey, 2, x, ey, 26);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, eye); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, ey, 26, 0, Math.PI * 2); g.fill();
    } else {
      g.fillStyle = eye; g.beginPath(); g.ellipse(x, ey, 14 * eyeSize, 19 * eyeSize, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(x - 4, ey - 7, 6 * eyeSize, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(x + 4, ey + 7, 2.5 * eyeSize, 0, Math.PI * 2); g.fill();
    }
  }
  if (blush) {
    g.fillStyle = 'rgba(255,110,140,0.55)';
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + s * 72, ey + 26, 16, 9, 0, 0, Math.PI * 2); g.fill(); }
  }
  g.strokeStyle = '#3a1a1a'; g.lineWidth = 5; g.lineCap = 'round';
  if (mouth === 'smile') { g.beginPath(); g.arc(cx, ey + 26, 10, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
  else if (mouth === 'cat') {
    g.beginPath(); g.arc(cx - 8, ey + 28, 8, 0, Math.PI); g.stroke();
    g.beginPath(); g.arc(cx + 8, ey + 28, 8, 0, Math.PI); g.stroke();
  } else if (mouth === 'fang') {
    g.beginPath(); g.moveTo(cx - 18, ey + 30); g.lineTo(cx + 18, ey + 30); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(cx - 12, ey + 30); g.lineTo(cx - 6, ey + 42); g.lineTo(cx - 2, ey + 30); g.fill();
    g.beginPath(); g.moveTo(cx + 12, ey + 30); g.lineTo(cx + 6, ey + 42); g.lineTo(cx + 2, ey + 30); g.fill();
  } else if (mouth === 'o') { g.fillStyle = '#5a1a2a'; g.beginPath(); g.ellipse(cx, ey + 32, 8, 10, 0, 0, Math.PI * 2); g.fill(); }
  const t = tex(c);
  faceCache.set(key, t);
  return t;
}

// Front patch of a sphere for mapping a face texture.
export function facePatch(radius, texture, { width = 1.7, top = 0.9, height = 1.2 } = {}) {
  const geo = new THREE.SphereGeometry(radius, 24, 16, Math.PI / 2 - width / 2, width, top, height);
  const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 2;
  m.raycast = () => {};
  return m;
}

export function lighten(hex, amt) {
  const c = new THREE.Color(hex);
  c.lerp(new THREE.Color('#ffffff'), amt);
  return '#' + c.getHexString();
}

const texCache = new Map();
function cached(key, fn) { if (!texCache.has(key)) texCache.set(key, fn()); return texCache.get(key); }

export function glowTexture() {
  return cached('glow', () => {
    const c = canvas(128, 128); const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.75)');
    gr.addColorStop(0.6, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return tex(c);
  });
}

export function shadowTexture() {
  return cached('shadow', () => {
    const c = canvas(64, 64); const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.7, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return tex(c);
  });
}

// Anime magic circle: rings, runes and a star.
export function magicCircleTexture(color = '#ffd36b') {
  return cached('mc' + color, () => {
    const S = 512; const c = canvas(S, S); const g = c.getContext('2d');
    g.translate(S / 2, S / 2);
    g.strokeStyle = color; g.fillStyle = color; g.shadowColor = color; g.shadowBlur = 12;
    const ring = (r, w) => { g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); };
    ring(240, 6); ring(222, 3); ring(150, 4); ring(70, 3);
    g.font = 'bold 22px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      g.save(); g.rotate(a); g.translate(0, -231); g.fillText(runes[i % runes.length], 0, 0); g.restore();
    }
    g.lineWidth = 4; g.beginPath();
    for (let i = 0; i <= 6; i++) {
      const a = (i * 2 / 6) * Math.PI * 2 * 1.0 - Math.PI / 2;
      const r = 215;
      const x = Math.cos(a * 1) * r, y = Math.sin(a * 1) * r;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
    // hexagram
    for (const off of [0, Math.PI / 3]) {
      g.beginPath();
      for (let i = 0; i <= 3; i++) { const a = off + i * (Math.PI * 2 / 3) - Math.PI / 2; g.lineTo(Math.cos(a) * 150, Math.sin(a) * 150); }
      g.stroke();
    }
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g.beginPath(); g.arc(Math.cos(a) * 185, Math.sin(a) * 185, 16, 0, Math.PI * 2); g.stroke(); }
    return tex(c);
  });
}

export function ringTexture(color = '#ffffff', inner = 0.72) {
  return cached('ring' + color + inner, () => {
    const S = 256; const c = canvas(S, S); const g = c.getContext('2d');
    const gr = g.createRadialGradient(S / 2, S / 2, S / 2 * inner, S / 2, S / 2, S / 2);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, color); gr.addColorStop(0.75, color); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); g.fill();
    return tex(c);
  });
}

// Target selection ring with arrow ticks.
export function targetRingTexture(color = '#ff4a3a') {
  return cached('tr' + color, () => {
    const S = 256; const c = canvas(S, S); const g = c.getContext('2d');
    g.translate(S / 2, S / 2);
    g.strokeStyle = color; g.fillStyle = color; g.shadowColor = color; g.shadowBlur = 10; g.lineWidth = 7;
    for (let i = 0; i < 4; i++) {
      g.save(); g.rotate(i * Math.PI / 2);
      g.beginPath(); g.arc(0, 0, 100, -0.55, 0.55); g.stroke();
      g.beginPath(); g.moveTo(112, 0); g.lineTo(126, -10); g.lineTo(126, 10); g.closePath(); g.fill();
      g.restore();
    }
    return tex(c);
  });
}

export function textTexture(text, { color = '#ffd84a', stroke = '#5a2a00', size = 110, font = 'Lilita One, Arial Black, sans-serif' } = {}) {
  return cached('tx' + text + color + stroke + size, () => {
    const c = canvas(128, 128); const g = c.getContext('2d');
    g.font = `${size}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 14; g.strokeStyle = stroke; g.strokeText(text, 64, 68);
    const gr = g.createLinearGradient(0, 20, 0, 110);
    gr.addColorStop(0, '#fffbe0'); gr.addColorStop(0.5, color); gr.addColorStop(1, '#e08a10');
    g.fillStyle = gr; g.fillText(text, 64, 68);
    return tex(c);
  });
}

export function wingTexture(color = '#9fe8ff') {
  return cached('wing' + color, () => {
    const c = canvas(256, 256); const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 256, 256, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.5, color); gr.addColorStop(1, 'rgba(255,190,240,0.75)');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(10, 246);
    g.bezierCurveTo(40, 120, 120, 10, 246, 12);
    g.bezierCurveTo(230, 110, 160, 210, 10, 246); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 4;
    g.stroke();
    g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(14, 242); g.quadraticCurveTo(80 + i * 30, 160 - i * 30, 200 - i * 20, 40 + i * 30); g.stroke(); }
    return tex(c);
  });
}

export function grassTexture() {
  return cached('grass', () => {
    const S = 256; const c = canvas(S, S); const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 2600; i++) {
      const v = 200 + Math.random() * 55;
      g.fillStyle = `rgba(${v - 30},${v},${v - 40},0.35)`;
      const x = Math.random() * S, y = Math.random() * S;
      g.fillRect(x, y, 2, 5 + Math.random() * 5);
    }
    for (let i = 0; i < 140; i++) {
      g.fillStyle = 'rgba(255,255,230,0.35)';
      g.beginPath(); g.arc(Math.random() * S, Math.random() * S, 1.5 + Math.random() * 2, 0, Math.PI * 2); g.fill();
    }
    return tex(c, { repeat: true });
  });
}

export function stoneTexture() {
  return cached('stone', () => {
    const S = 256; const c = canvas(S, S); const g = c.getContext('2d');
    g.fillStyle = '#d9d2c3'; g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(90,80,70,0.55)'; g.lineWidth = 3;
    const n = 6;
    for (let r = 0; r < n; r++) {
      const off = (r % 2) * (S / n / 2);
      g.beginPath(); g.moveTo(0, r * S / n); g.lineTo(S, r * S / n); g.stroke();
      for (let k = 0; k <= n; k++) { g.beginPath(); g.moveTo(off + k * S / n, r * S / n); g.lineTo(off + k * S / n, (r + 1) * S / n); g.stroke(); }
    }
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(120,110,100,${Math.random() * 0.15})`; g.fillRect(Math.random() * S, Math.random() * S, 4, 4); }
    return tex(c, { repeat: true });
  });
}

export function cloudTexture() {
  return cached('cloud', () => {
    const c = canvas(256, 128); const g = c.getContext('2d');
    for (let i = 0; i < 14; i++) {
      const x = 40 + Math.random() * 176, y = 50 + Math.random() * 40, r = 22 + Math.random() * 26;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    return tex(c);
  });
}

// Vertical beam texture: bright at the base, fading to nothing at the top.
export function beamTexture() {
  return cached('beam', () => {
    const c = canvas(8, 128); const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 128, 0, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 8, 128);
    return tex(c);
  });
}
