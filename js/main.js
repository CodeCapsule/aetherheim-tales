// Boot: renderer, title screen, character creation, loading and the main loop.
import * as THREE from 'three';
import { CLASSES, CLASS_ORDER, TIPS } from './data.js';
import { World } from './world.js';
import { SPAWNS } from './data.js';
import { FX } from './fx.js';
import { UI } from './ui.js';
import { Sfx } from './sfx.js';
import { Portraits } from './portrait.js';
import { Game, newSave, migrateSave, SAVE_KEY } from './game.js';
import { ico } from './icons.js';
import { buildHumanoid, heroLook, animateHumanoid } from './models.js';
import { cleanApp } from './models-hero.js';
import { buildCustomizer, randomApp } from './customizer.js';
import { magicCircleTexture } from './toon.js';
import { connectLive, live, onLive } from './live.js';
import { AdminPanel } from './admin.js';
import { getServer, setServer, mpEnabled, SERVERS, peekServers, stopPeek } from './mp.js';
import { fitTouch, UIZ } from './touchfit.js';

const $ = (id) => document.getElementById(id);
const app = $('app');
// an earlier version installed as an app with an offline cache: remove that cache and its service worker
// (only this game's, other pages on the same site keep theirs)
if (navigator.serviceWorker && !window.claude) {
  const scope = new URL('./', location.href).href;
  navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => { if (r.scope === scope) r.unregister(); })).catch(() => {});
  window.caches?.delete('aetherheim-v1').catch(() => {});
}
const frame = () => new Promise((r) => requestAnimationFrame(() => r()));

let renderer, scene, camera, world, fx, ui, sfx, portraits, sun, lights, game = null;
let mode = 'title', preview = null, previewYaw = 0.4, hotSave = null, admin = null;

function loadSave() {
  if (hotSave) return hotSave;
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return s && [1, 2, 3].includes(s.v) && CLASSES[s.cls] ? migrateSave(s) : null; } catch { return null; }
}

async function init() {
  fitTouch();
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
  const steps = ['buildTerrain', 'buildWater', 'buildSky', 'buildTown', 'buildDungeonGates', 'buildBridges', 'buildRuins', 'buildOverlook', 'buildAltar', 'buildFarm', 'buildOutposts', 'buildBiomeProps', 'buildDangerZone', 'buildTrees', 'buildGroundCover', 'buildBoundary', 'buildWorldTree', 'buildIslands', 'finishBatches', 'buildAmbient', 'buildBiomeWeather', 'buildMinimap'];
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
  fitTouch();
  ui && ui.fitPhoneHud && ui.fitPhoneHud();
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  fx.setViewport(innerHeight);
}

// ---------------------------------------------------------------- title
// the winged star crest behind the logo lettering (and a small copy for the corner)
function crestArt(small = false) {
  const feather = (bx, by, deg, len, w) => {
    const r = (deg * Math.PI) / 180, dx = Math.cos(r), dy = Math.sin(r), px = -dy, py = dx, f = (n) => n.toFixed(1);
    return `<path d="M${bx} ${by}Q${f(bx + dx * len * 0.45 + px * w)} ${f(by + dy * len * 0.45 + py * w)} ${f(bx + dx * len)} ${f(by + dy * len)}Q${f(bx + dx * len * 0.5 - px * w * 0.55)} ${f(by + dy * len * 0.5 - py * w * 0.55)} ${bx} ${by}Z"/>`;
  };
  const star = `<g transform="translate(300 55) scale(.85)"><circle r="34" fill="url(#cr-navy)" stroke="url(#cr-gold)" stroke-width="5"/>
    <path d="M0 -64L13 -13L54 0L13 13L0 66L-13 13L-54 0L-13 -13Z" fill="url(#cr-gold)" stroke="#4a2604" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M0 -27L17 0L0 27L-17 0Z" fill="url(#cr-gem)" stroke="#0c2460" stroke-width="2"/><path d="M0 -27L17 0H0Z" fill="#fff" opacity=".4"/></g>`;
  const defs = `<defs><linearGradient id="cr-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6c0"/><stop offset=".45" stop-color="#ffd24a"/><stop offset="1" stop-color="#b86a0a"/></linearGradient>
    <linearGradient id="cr-gem" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d8f4ff"/><stop offset=".5" stop-color="#4aa8ff"/><stop offset="1" stop-color="#1a3aa8"/></linearGradient>
    <radialGradient id="cr-navy" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#2a56b8"/><stop offset="1" stop-color="#0c1c4a"/></radialGradient>
    <linearGradient id="cr-wing" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#2e66c8"/><stop offset=".4" stop-color="#8cc8ff"/><stop offset="1" stop-color="#ffffff"/></linearGradient>
    <linearGradient id="cr-covert" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#4a8ae8"/><stop offset="1" stop-color="#e8f6ff"/></linearGradient></defs>`;
  if (small) return `<svg viewBox="248 0 104 112" aria-hidden="true">${defs}${star}</svg>`;
  // long flight feathers fanned out, then a row of short covert feathers over their roots
  const F = [[244, 128, 21], [231, 160, 23], [218, 186, 25], [205, 196, 25], [192, 186, 24], [180, 160, 22], [169, 124, 19]];
  const C = [[236, 92, 20], [219, 104, 21], [202, 104, 21], [186, 92, 19], [172, 74, 16]];
  const wing = F.map(([deg, len, w], i) => feather(238 - i * 2, 158 + i * 2, deg, len, w)).join('')
    + `<g fill="url(#cr-covert)">${C.map(([deg, len, w], i) => feather(244 - i * 2, 160 + i * 2, deg, len, w)).join('')}</g>`;
  return `<svg viewBox="0 0 600 300" aria-hidden="true">${defs}<g fill="url(#cr-wing)" stroke="#102a62" stroke-width="2.5" stroke-linejoin="round">${wing}<g transform="translate(600 0) scale(-1 1)">${wing}</g></g>${star}</svg>`;
}
const PEOPLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.4"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6z"/><circle cx="16.8" cy="9" r="2.8"/><path d="M15 14.2c3.8-.7 7 1.5 7 5.8h-5.2z"/></svg>';
const SWORDS = '<svg viewBox="0 0 32 32" aria-hidden="true"><g fill="#5a2c02"><path d="M5 3l12 12-2 2L3 5V3z"/><path d="M27 3L15 15l2 2L29 5V3z"/><path d="M8 18l6 6-2 2-6-6zM24 18l-6 6 2 2 6-6z"/><path d="M5 23l4 4-3 3-4-4zM27 23l-4 4 3 3 4-4z"/></g></svg>';
const popLabel = (n) => (n >= 30 ? 'High' : n >= 10 ? 'Medium' : 'Low');

function showTitle(save) {
  mode = 'title';
  $('scr-title').hidden = false;
  const logo = $('t-logo'); if (!logo.querySelector('svg')) logo.insertAdjacentHTML('afterbegin', crestArt());
  $('title-top').innerHTML = `${crestArt(true)}<span>Hiraya Tales Online</span>`;
  $('title-feats').innerHTML = [['smithing', 'Craft'], ['trade', 'Trade'], ['map', 'Explore'], ['farm', 'Grow'], ['online', 'Together']].map(([k, t]) => `<span>${ico(k)}${t}</span>`).join('<i></i>');
  const list = $('server-list'); list.innerHTML = '';
  const cur = getServer(), multi = mpEnabled(), rows = {};
  for (const sv of SERVERS) {
    const b = document.createElement('button');
    b.className = 'server' + (sv.id === cur ? ' sel' : '');
    b.innerHTML = `<span class="sv-ic">${ico(sv.icon)}</span><span class="sv-name">${sv.name}</span><span class="sv-st${multi ? ' wait' : ''}"><i></i><span>${multi ? 'Checking' : 'Solo'}</span></span><span class="sv-pop">${multi ? `${PEOPLE}<span class="pl">—</span>` : ''}</span><span class="sv-go">›</span>`;
    b.setAttribute('aria-pressed', String(sv.id === cur));
    b.onclick = () => { list.querySelectorAll('.server').forEach((x) => { x.classList.remove('sel'); x.setAttribute('aria-pressed', 'false'); }); b.classList.add('sel'); b.setAttribute('aria-pressed', 'true'); setServer(sv.id); sfx.ensure(); sfx.play('click'); };
    list.appendChild(b); rows[sv.id] = b;
  }
  // live player counts per server (public website only)
  peekServers((id, n) => {
    const r = rows[id]; if (!r) return;
    const st = r.querySelector('.sv-st'), pop = r.querySelector('.sv-pop');
    st.className = 'sv-st ' + (n == null ? 'off' : 'on'); st.querySelector('span').textContent = n == null ? 'Offline' : 'Online';
    pop.innerHTML = n == null ? '' : `${PEOPLE}<span class="pl">${popLabel(n)}</span><b>${n}</b>`;
    r.title = n == null ? 'Cannot reach this server right now' : `${n} hero${n === 1 ? '' : 'es'} online`;
  });
  refreshTitleLive();
  const h3 = document.querySelector('#scr-title .srv-panel h3'); if (h3) { h3.textContent = 'Server'; h3.title = multi ? 'Everyone plays together on one server' : ''; }
  const cont = $('btn-continue'), enter = $('btn-enter');
  if (save) {
    cont.hidden = false; cont.className = 'btn-gold';
    cont.innerHTML = `${SWORDS}<span>Enter Game<small>Continue as ${escapeHtml(save.name)} · Lv ${save.level}</small></span>`;
    enter.className = 'btn-gold alt'; enter.textContent = 'Create a New Hero';
  } else { enter.className = 'btn-gold'; enter.innerHTML = `${SWORDS}<span>Enter Game</span>`; }
  cont.onclick = () => { sfx.ensure(); sfx.play('open'); startGame(save); };
  enter.onclick = () => { sfx.ensure(); sfx.play('open'); showCreate(); };
}

// live link on the title screen: GM console entry (owner/editors, or any local copy), announcement and notices
function refreshTitleLive() {
  const box = document.querySelector('#scr-title .srv-panel'); if (!box) return;
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
  mode = 'create'; stopPeek();
  $('scr-title').hidden = true; $('scr-create').hidden = false;
  const st = { cls: 'knight', app: randomApp('human') };
  st.app.helm = true;
  const stage = new THREE.Group(); stage.position.set(0, world.heightAt(0, -136) + 0.3, -136); scene.add(stage);
  const circle = new THREE.Mesh(new THREE.CircleGeometry(2.2, 48), new THREE.MeshBasicMaterial({ map: magicCircleTexture('#ffd36b'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  circle.rotation.x = -Math.PI / 2; circle.position.y = 0.06; stage.add(circle);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.3, 40), new THREE.MeshToonMaterial({ color: 0xe8e0d0 })); ped.position.y = -0.12; stage.add(ped);
  preview = { stage, circle, model: null };
  let pending = 0;
  const rebuild = (puff = false) => {
    if (preview.model) stage.remove(preview.model);
    preview.model = buildHumanoid(heroLook(st.cls, st.app, {}));
    stage.add(preview.model);
    if (puff) fx.spawnPuff(stage.position.clone().setY(0.3), new THREE.Color(CLASSES[st.cls].elemColor).getHex());
  };
  // sliders rebuild at most every few frames
  const soon = () => { if (!pending) pending = requestAnimationFrame(() => { pending = 0; rebuild(); }); };
  const cz = buildCustomizer($('class-info'), st, soon, { sfx });
  const cl = $('class-list'); cl.innerHTML = '';
  for (const id of CLASS_ORDER) {
    const C = CLASSES[id];
    const b = document.createElement('button');
    b.className = 'class-card' + (id === st.cls ? ' sel' : '');
    b.innerHTML = `<span class="ci">${ico(C.icon)}</span><span><b>${C.name}</b><small style="color:${C.elemColor}">${C.role}</small> <small style="color:var(--muted)">· ${C.weapon}</small></span>`;
    b.onclick = () => { st.cls = id; cl.querySelectorAll('.class-card').forEach((x) => x.classList.remove('sel')); b.classList.add('sel'); cz.render(); rebuild(true); sfx.play('click'); };
    cl.appendChild(b);
  }
  $('dice').innerHTML = ico('dice');
  $('name-in').value = randName();
  $('dice').onclick = () => { $('name-in').value = randName(); sfx.play('click'); };
  $('btn-create').onclick = () => {
    const name = $('name-in').value.trim();
    if (!/^[\p{L}\p{N} _-]{2,14}$/u.test(name)) { $('name-in').focus(); $('name-in').style.borderColor = '#ff5a4a'; return; }
    sfx.play('quest');
    const app = cleanApp(st.app);
    const S = newSave({ name, cls: st.cls, gender: app.body === 'a' ? 'm' : 'f', hair: app.hair, eye: app.eye, app });
    scene.remove(stage); preview = null;
    $('scr-create').hidden = true;
    startGame(S);
  };
  // drag to rotate preview
  let drag = null;
  renderer.domElement.onpointerdown = (e) => { if (mode === 'create') drag = e.clientX; };
  addEventListener('pointerup', () => { drag = null; });
  addEventListener('pointermove', (e) => { if (drag != null && mode === 'create') { previewYaw += (e.clientX - drag) * 0.01; drag = e.clientX; } });
  rebuild(true);
}

// ---------------------------------------------------------------- game
async function startGame(S) {
  mode = 'loading'; stopPeek();
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
  sfx.on = S.settings.sound; sfx.voice = S.app?.voice ?? 0.5;
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
  fx.update(dt, renderer.domElement.clientWidth / UIZ.k, renderer.domElement.clientHeight / UIZ.k);
  renderer.render(scene, camera);
}

// hot-reload support inside the Artifact viewer: keep the hero across republishes
window.claude?.hot?.snapshot?.(() => (game ? { S: game.S } : {}));
const boot = (data) => { if (data && data.S && CLASSES[data.S.cls]) hotSave = data.S; init(); };
if (window.claude?.hot?.ready) window.claude.hot.ready(boot); else boot(window.claude?.hot?.data ?? {});
