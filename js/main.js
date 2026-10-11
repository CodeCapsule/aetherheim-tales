// Boot: renderer, title screen, character creation, loading and the main loop.
import * as THREE from 'three';
import { CLASSES, TIPS } from './data.js';
import { World } from './world.js';
import { SPAWNS } from './data.js';
import { FX } from './fx.js';
import { UI } from './ui.js';
import { Sfx } from './sfx.js';
import { Portraits } from './portrait.js';
import { Game, newSave, migrateSave, SAVE_KEY } from './game.js';
import { ico } from './icons.js';
import { buildHumanoid, classLook, HAIR_COLORS, EYE_COLORS, animateHumanoid } from './models.js';
import { magicCircleTexture } from './toon.js';
import { connectLive, live, onLive } from './live.js';
import { AdminPanel } from './admin.js';

const $ = (id) => document.getElementById(id);
const app = $('app');
const frame = () => new Promise((r) => requestAnimationFrame(() => r()));

let renderer, scene, camera, world, fx, ui, sfx, portraits, sun, lights, game = null;
let mode = 'title', preview = null, previewYaw = 0.4, hotSave = null, admin = null;

function loadSave() {
  if (hotSave) return hotSave;
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return s && [1, 2, 3].includes(s.v) && CLASSES[s.cls] ? migrateSave(s) : null; } catch { return null; }
}

async function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'gl';
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', 'Game world');
  app.prepend(renderer.domElement);

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xcfeaff, 180, 1500);
  camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.3, 3200);
  camera.position.set(60, 40, 90);

  lights = { hemi: new THREE.HemisphereLight(0xe8f4ff, 0x6a8a4a, 1.3), ambient: new THREE.AmbientLight(0xffffff, 0.45) };
  scene.add(lights.hemi); scene.add(lights.ambient);
  sun = new THREE.DirectionalLight(0xfff2d8, 2.3);
  sun.position.set(50, 70, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 260;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.05;
  scene.add(sun); scene.add(sun.target);

  fx = new FX(scene, camera, $('world-ui'));
  fx.setViewport(innerHeight);
  sfx = new Sfx();
  portraits = new Portraits();
  ui = new UI();
  admin = new AdminPanel(() => (game ? game.S : loadSave()));
  ui.openAdmin = () => admin.open();
  ui.adminAllowed = () => admin.allowed();
  onLive(() => refreshTitleLive());
  connectLive().then(() => { if (location.hash === '#admin' && admin.allowed()) admin.open(); });

  // loading screen while the world builds
  const loading = $('scr-loading'); loading.hidden = false; $('scr-title').hidden = true;
  $('load-tip').textContent = 'Tip: ' + TIPS[(Math.random() * TIPS.length) | 0];
  world = new World(scene);
  world.spawnAreas = SPAWNS;
  const steps = ['buildTerrain', 'buildWater', 'buildSky', 'buildTown', 'buildDungeonGates', 'buildBridges', 'buildRuins', 'buildOverlook', 'buildAltar', 'buildFarm', 'buildOutposts', 'buildBiomeProps', 'buildTrees', 'buildGroundCover', 'buildBoundary', 'buildWorldTree', 'buildIslands', 'finishBatches', 'buildAmbient', 'buildBiomeWeather', 'buildMinimap'];
  for (let i = 0; i < steps.length; i++) {
    world[steps[i]]();
    $('load-fill').style.width = ((i + 1) / steps.length) * 100 + '%';
    await frame();
  }
  renderer.compile(scene, camera);
  addEventListener('resize', onResize);
  requestAnimationFrame(loop);
  loading.hidden = true;
  const save = loadSave();
  if (hotSave) { startGame(migrateSave(hotSave)); return; }
  showTitle(save);
}

function onResize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  fx.setViewport(innerHeight);
}

// ---------------------------------------------------------------- title
function showTitle(save) {
  mode = 'title';
  $('scr-title').hidden = false;
  const servers = [['S1 Carlyle', 'New', '#3ac84a'], ['S2 Sylvan Haven', 'Hot', '#ff8a2a'], ['S3 Breezy Meadow', 'Smooth', '#3ac84a'], ['S4 Mossveil', 'Full', '#ff3a3a'], ['S5 Elder Ruins', 'Hot', '#ff8a2a'], ['S6 Yggdrasil', 'Smooth', '#3ac84a']];
  const list = $('server-list'); list.innerHTML = '';
  servers.forEach(([n, tag, col], i) => {
    const b = document.createElement('button');
    b.className = 'server' + (i === 0 ? ' sel' : '');
    b.innerHTML = `<span class="dot" style="background:${col};box-shadow:0 0 6px ${col}"></span>${n}<span class="tag" style="background:${col}">${tag}</span>`;
    b.onclick = () => { list.querySelectorAll('.server').forEach((x) => x.classList.remove('sel')); b.classList.add('sel'); sfx.ensure(); sfx.play('click'); };
    list.appendChild(b);
  });
  refreshTitleLive();
  const cont = $('btn-continue');
  if (save) { cont.hidden = false; cont.textContent = `Continue · ${save.name} Lv${save.level}`; $('btn-enter').textContent = 'New Hero'; }
  cont.onclick = () => { sfx.ensure(); sfx.play('open'); startGame(save); };
  $('btn-enter').onclick = () => { sfx.ensure(); sfx.play('open'); showCreate(); };
}

// live link on the title screen: GM console entry (owner/editors, or any local copy), announcement and notices
function refreshTitleLive() {
  const box = document.querySelector('#scr-title .server-box'); if (!box) return;
  let link = $('btn-admin');
  if (!link) {
    link = document.createElement('button'); link.id = 'btn-admin'; link.className = 'adm-link';
    link.innerHTML = `${ico('crown', 'ico inl')} Game Master Console`;
    link.onclick = () => { sfx.ensure(); sfx.play('open'); admin.open(); };
    box.appendChild(link);
  }
  link.hidden = !admin || !admin.allowed() || !live.ready;
  let note = $('title-live');
  if (!note) { note = document.createElement('div'); note.id = 'title-live'; box.parentNode.insertBefore(note, box.nextSibling); }
  const c = live.config || {}, parts = [];
  if (c.maint?.on && c.maint.text) parts.push(`<div class="tl maint">${ico('timer', 'ico inl')} ${escapeHtml(c.maint.text)}</div>`);
  if (c.motd) parts.push(`<div class="tl motd">${ico('star', 'ico inl')} ${escapeHtml(c.motd)}</div>`);
  if (c.boost && c.boost.until > Date.now()) parts.push(`<div class="tl boost">${ico('exp', 'ico inl')} ${escapeHtml(c.boost.name)}: ${c.boost.exp > 1 ? `x${c.boost.exp} EXP ` : ''}${c.boost.gold > 1 ? `x${c.boost.gold} Gold` : ''}</div>`);
  note.innerHTML = parts.join('');
  note.hidden = !parts.length;
}
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

// ---------------------------------------------------------------- create
const SYL_A = ['Ae', 'Lu', 'Ri', 'Sel', 'Fae', 'Ka', 'Mi', 'No', 'Va', 'Ely', 'Thal', 'Zy', 'Ori', 'Cel', 'Yu', 'Ne'];
const SYL_B = ['ra', 'na', 'lia', 'ris', 'wen', 'vyn', 'dor', 'mir', 'iel', 'ka', 'sha', 'nor', 'ssa', 'thas', 'rin', 'le'];
const randName = () => SYL_A[(Math.random() * SYL_A.length) | 0] + SYL_B[(Math.random() * SYL_B.length) | 0] + (Math.random() < 0.3 ? SYL_B[(Math.random() * SYL_B.length) | 0] : '');

function showCreate() {
  mode = 'create';
  $('scr-title').hidden = true; $('scr-create').hidden = false;
  const st = { cls: 'knight', gender: 'f', hair: HAIR_COLORS[0], eye: EYE_COLORS[0] };
  const stage = new THREE.Group(); stage.position.set(0, world.heightAt(0, -136) + 0.3, -136); scene.add(stage);
  const circle = new THREE.Mesh(new THREE.CircleGeometry(2.2, 48), new THREE.MeshBasicMaterial({ map: magicCircleTexture('#ffd36b'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  circle.rotation.x = -Math.PI / 2; circle.position.y = 0.06; stage.add(circle);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.3, 40), new THREE.MeshToonMaterial({ color: 0xe8e0d0 })); ped.position.y = -0.12; stage.add(ped);
  preview = { stage, circle, model: null };
  const rebuild = () => {
    if (preview.model) stage.remove(preview.model);
    preview.model = buildHumanoid(classLook(st.cls, st.gender, st.hair, st.eye, { wings: true }));
    stage.add(preview.model);
    fx.spawnPuff(stage.position.clone().setY(0.3), new THREE.Color(CLASSES[st.cls].elemColor).getHex());
  };
  const info = () => {
    const C = CLASSES[st.cls];
    $('class-info').innerHTML = `<h2>${C.name}</h2><span class="elem" style="background:${C.elemColor}">${C.element} Spirit</span><p>${C.desc}</p>
      <div class="talents">${C.talents.map((t) => `<div><b>${t.name}</b>${t.role} · ${t.desc}</div>`).join('')}</div>
      <div class="rating">${Object.entries(C.ratings).map(([k, v]) => `<span>${k}</span><span class="pips">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= v ? 'on' : ''}"></i>`).join('')}</span>`).join('')}</div>`;
  };
  const cl = $('class-list'); cl.innerHTML = '';
  for (const [id, C] of Object.entries(CLASSES)) {
    const b = document.createElement('button');
    b.className = 'class-card' + (id === st.cls ? ' sel' : '');
    b.innerHTML = `<span class="ci">${ico(C.icon)}</span><span><b>${C.name}</b><small style="color:${C.elemColor}">${C.element}</small> <small style="color:var(--muted)">· ${C.talents[0].role} / ${C.talents[1].role}</small></span>`;
    b.onclick = () => { st.cls = id; cl.querySelectorAll('.class-card').forEach((x) => x.classList.remove('sel')); b.classList.add('sel'); info(); rebuild(); sfx.play('click'); };
    cl.appendChild(b);
  }
  $('gender-seg').querySelectorAll('button').forEach((b) => b.onclick = () => { st.gender = b.dataset.g; $('gender-seg').querySelectorAll('button').forEach((x) => x.classList.toggle('sel', x === b)); rebuild(); sfx.play('click'); });
  const sw = (el, arr, key) => {
    el.innerHTML = '';
    arr.forEach((c, i) => { const b = document.createElement('button'); b.style.background = c; b.className = i === 0 ? 'sel' : ''; b.setAttribute('aria-label', key + ' color ' + (i + 1)); b.onclick = () => { st[key] = c; el.querySelectorAll('button').forEach((x) => x.classList.toggle('sel', x === b)); rebuild(); }; el.appendChild(b); });
  };
  sw($('hair-sw'), HAIR_COLORS, 'hair'); sw($('eye-sw'), EYE_COLORS, 'eye');
  $('dice').innerHTML = ico('dice');
  $('name-in').value = randName();
  $('dice').onclick = () => { $('name-in').value = randName(); sfx.play('click'); };
  $('btn-create').onclick = () => {
    const name = $('name-in').value.trim();
    if (!/^[\p{L}\p{N} _-]{2,14}$/u.test(name)) { $('name-in').focus(); $('name-in').style.borderColor = '#ff5a4a'; return; }
    sfx.play('quest');
    const S = newSave({ name, ...st });
    scene.remove(stage); preview = null;
    $('scr-create').hidden = true;
    startGame(S);
  };
  // drag to rotate preview
  let drag = null;
  renderer.domElement.onpointerdown = (e) => { if (mode === 'create') drag = e.clientX; };
  addEventListener('pointerup', () => { drag = null; });
  addEventListener('pointermove', (e) => { if (drag != null && mode === 'create') { previewYaw += (e.clientX - drag) * 0.01; drag = e.clientX; } });
  info(); rebuild();
}

// ---------------------------------------------------------------- game
async function startGame(S) {
  mode = 'loading';
  $('scr-title').hidden = true; $('scr-create').hidden = true;
  const loading = $('scr-loading'); loading.hidden = false; $('load-fill').style.width = '30%';
  $('load-tip').textContent = 'Tip: ' + TIPS[(Math.random() * TIPS.length) | 0];
  await frame(); await frame();
  renderer.domElement.onpointerdown = null;
  game = new Game({ renderer, scene, camera, world, fx, portraits, ui, sfx, S, sun, lights });
  game.start();
  $('load-fill').style.width = '100%';
  await frame();
  loading.hidden = true;
  mode = 'game';
  sfx.on = S.settings.sound;
  if (!S.settings.shadows) game.setSetting('shadows', false);
  sfx.startMusic();
  game.save();
  renderer.domElement.focus();
  window.__dbg = { game, ui, fx, world, renderer, step(n = 20) { for (let i = 0; i < n; i++) { game.update(0.05); ui.frame(0.05); world.update(0.05, t += 0.05); fx.update(0.05, innerWidth, innerHeight); } } };
}

let last = performance.now(), t = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
  if (mode === 'game' && game) { game.update(dt); ui.frame(dt); }
  else if (mode === 'create' && preview) {
    const p = preview.stage.position;
    camera.position.set(p.x + 0.4, p.y + 1.7, p.z + 6.4);
    camera.lookAt(p.x - (innerWidth > 900 ? 0 : 0), p.y + 1.15, p.z);
    if (preview.model) { preview.model.rotation.y = previewYaw + Math.sin(t * 0.4) * 0.15; animateHumanoid(preview.model, 'idle', t); }
    preview.circle.rotation.z = t * 0.5;
  } else {
    const a = t * 0.04;
    camera.position.set(Math.sin(a) * 75, 32 + Math.sin(t * 0.1) * 4, Math.cos(a) * 75 + 10);
    camera.lookAt(0, 14, -40);
  }
  world.update(dt, t);
  fx.update(dt, renderer.domElement.clientWidth, renderer.domElement.clientHeight);
  renderer.render(scene, camera);
}

// hot-reload support inside the Artifact viewer: keep the hero across republishes
window.claude?.hot?.snapshot?.(() => (game ? { S: game.S } : {}));
const boot = (data) => { if (data && data.S && CLASSES[data.S.cls]) hotSave = data.S; init(); };
if (window.claude?.hot?.ready) window.claude.hot.ready(boot); else boot(window.claude?.hot?.data ?? {});
