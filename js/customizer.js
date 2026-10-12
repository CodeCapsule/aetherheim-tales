// The hero customizer: race, body, face, hair, marks and shareable presets. Used on the creation screen and for the
// monthly re-customization at Coco's Wardrobe.
import { CLASSES, RACES } from './data.js';
import { SKIN_TONES, HERO_HAIR, HAIR_STYLES, BEARD_STYLES, MAKEUP, SCARS, TATTOOS, FACE_SHAPES, BEAST_KINDS, encodeApp, decodeApp } from './models-hero.js';

const pickR = (a) => a[(Math.random() * a.length) | 0];
const PRESET_KEY = 'aetherheim_presets';
const EYE_SET = ['#3a2a20', '#3a6fd8', '#2fae6a', '#c0462e', '#8a4ad8', '#d89a2a', '#5ad8e8', '#9a9aa8'];
const MAKEUP_COLORS = ['#c0304a', '#ff7aa8', '#8a3ad8', '#2a2a3a', '#e8a020'];
const TATTOO_COLORS = ['#5ff0d8', '#2a4a6a', '#c02a2a', '#ffd84a', '#9a6aff'];
const LABEL = { short: 'Short', messy: 'Messy', spiky: 'Spiky', long: 'Long', bob: 'Bob', ponytail: 'Ponytail', bun: 'Bun', twin: 'Twin tails', braid: 'Braid', mohawk: 'Mohawk', curly: 'Curly', bald: 'Bald', none: 'None', stubble: 'Stubble', mustache: 'Mustache', goatee: 'Goatee', full: 'Full', braided: 'Braided', liner: 'Eyeliner', rouge: 'Rouge', lips: 'Lip color', warpaint: 'War paint', cheek: 'Cheek', eye: 'Eye', nose: 'Nose', chin: 'Chin', tribal: 'Tribal', runes: 'Runes', spirals: 'Spirals', dots: 'Dots', round: 'Round', square: 'Square', heart: 'Heart', wolf: 'Wolf', fox: 'Fox', cat: 'Cat' };
export function randomApp(race) {
  const r = race || pickR(Object.keys(RACES));
  return {
    race: r, body: Math.random() < 0.5 ? 'a' : 'b', beast: pickR(BEAST_KINDS), skin: pickR(r === 'draken' ? ['#c9785c', '#a9aab6', '#dba07c', '#94603f'] : r === 'sylvan' ? ['#f7dcc8', '#e2ecd8', '#d2dcf0', '#eec0a0'] : SKIN_TONES.slice(0, 6)),
    hair: pickR(HERO_HAIR), eye: pickR(EYE_SET), hairStyle: pickR(HAIR_STYLES.filter((x) => x !== 'bald')), beardStyle: Math.random() < 0.3 ? pickR(BEARD_STYLES) : 'none',
    face: pickR(FACE_SHAPES), faceW: Math.random(), eyeSize: Math.random(), noseSize: Math.random(), build: Math.random(), height: Math.random(), voice: Math.random(),
    makeup: Math.random() < 0.25 ? pickR(MAKEUP) : 'none', makeupColor: pickR(MAKEUP_COLORS), scar: Math.random() < 0.2 ? pickR(SCARS) : 'none',
    tattoo: r === 'sylvan' ? pickR(TATTOOS.filter((x) => x !== 'none')) : Math.random() < 0.15 ? pickR(TATTOOS) : 'none', tattooColor: pickR(TATTOO_COLORS), helm: true,
  };
}

// the customizer (also used for the monthly re-customization in game); onChange(app) after every edit
export function buildCustomizer(root, st, onChange, { showClass = true, sfx = null } = {}) {
  const tabs = [...(showClass ? [['cls', 'Class']] : []), ['race', 'Race'], ['body', 'Body'], ['face', 'Face'], ['hair', 'Hair'], ['marks', 'Marks'], ['preset', 'Presets']];
  let cur = tabs[0][0];
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const changed = () => { onChange(st.app); render(); };
  const seg = (label, key, list, fmt = (v) => LABEL[v] || v) => {
    const w = el('div', 'cz-row'); w.appendChild(el('div', 'lbl', label));
    const s = el('div', 'cz-seg');
    for (const v of list) { const b = el('button', st.app[key] === v ? 'sel' : '', fmt(v)); b.onclick = () => { st.app[key] = v; changed(); }; s.appendChild(b); }
    w.appendChild(s); return w;
  };
  const sw = (label, key, list) => {
    const w = el('div', 'cz-row'); w.appendChild(el('div', 'lbl', label));
    const s = el('div', 'swatches');
    for (const c of list) { const b = el('button', st.app[key] === c ? 'sel' : ''); b.style.background = c; b.setAttribute('aria-label', `${label} ${c}`); b.onclick = () => { st.app[key] = c; changed(); }; s.appendChild(b); }
    w.appendChild(s); return w;
  };
  const slider = (label, key, lo, hi) => {
    const w = el('div', 'cz-row cz-sl'); w.appendChild(el('div', 'lbl', label));
    const r = el('input'); r.type = 'range'; r.min = 0; r.max = 100; r.value = Math.round((st.app[key] ?? 0.5) * 100); r.setAttribute('aria-label', label);
    r.oninput = () => { st.app[key] = r.value / 100; onChange(st.app); };
    const f = el('div', 'cz-ends', `<span>${lo}</span><span>${hi}</span>`);
    w.appendChild(r); w.appendChild(f); return w;
  };
  const render = () => {
    root.innerHTML = '';
    const tb = el('div', 'cz-tabs');
    for (const [id, label] of tabs) { const b = el('button', cur === id ? 'sel' : '', label); b.onclick = () => { cur = id; render(); }; tb.appendChild(b); }
    root.appendChild(tb);
    const body = el('div', 'cz-body'); root.appendChild(body);
    const A = st.app;
    if (cur === 'cls') {
      const C = CLASSES[st.cls];
      body.innerHTML = `<h2>${C.name}</h2><span class="elem" style="background:${C.elemColor}">${C.role} · ${C.weapon}</span><p>${C.desc}</p>
        <div class="talents">${C.paths.map((p, i) => `<div><b>${p}</b>Awakening at Lv 100 · ${C.pathRole[i]}</div>`).join('')}</div>
        <div class="cz-note">Best-fit sets: ${C.sets}</div>
        <div class="rating">${Object.entries(C.ratings).map(([k, v]) => `<span>${k}</span><span class="pips">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= v ? 'on' : ''}"></i>`).join('')}</span>`).join('')}</div>`;
    } else if (cur === 'race') {
      const list = el('div', 'cz-races');
      for (const [id, R] of Object.entries(RACES)) {
        const b = el('button', 'cz-race' + (A.race === id ? ' sel' : ''), `<b style="color:${R.color}">${R.name}</b><small>${R.look}</small><span>${R.bonus}</span><em>Home: ${R.home}</em>`);
        b.onclick = () => { A.race = id; if (id === 'sylvan' && A.tattoo === 'none') A.tattoo = 'tribal'; changed(); };
        list.appendChild(b);
      }
      body.appendChild(list);
      if (A.race === 'beastkin') body.appendChild(seg('Beast traits', 'beast', BEAST_KINDS));
      body.appendChild(sw('Skin', 'skin', SKIN_TONES));
      body.appendChild(el('div', 'cz-note', 'Any race can play any class. Body type is chosen separately from class and race.'));
    } else if (cur === 'body') {
      body.appendChild(seg('Body type', 'body', ['a', 'b'], (v) => (v === 'a' ? 'Type A · broad' : 'Type B · slim')));
      body.appendChild(slider('Build', 'build', 'Lean', 'Stocky'));
      body.appendChild(slider('Height', 'height', 'Short', 'Tall'));
      const v = slider('Voice', 'voice', 'Low', 'High');
      const hear = el('button', 'btn small gray', 'Hear'); hear.onclick = () => { if (!sfx) return; sfx.ensure(); const v = sfx.voice; sfx.voice = A.voice ?? 0.5; sfx.play('voice'); sfx.voice = v; };
      v.appendChild(hear); body.appendChild(v);
      const hb = el('div', 'cz-row'); hb.appendChild(el('div', 'lbl', 'Class headgear'));
      const hs = el('div', 'cz-seg'); for (const [val, lab] of [[true, 'Show'], [false, 'Hide']]) { const b = el('button', (A.helm !== false) === val ? 'sel' : '', lab); b.onclick = () => { A.helm = val; changed(); }; hs.appendChild(b); }
      hb.appendChild(hs); body.appendChild(hb);
    } else if (cur === 'face') {
      body.appendChild(seg('Face shape', 'face', FACE_SHAPES));
      body.appendChild(slider('Face width', 'faceW', 'Narrow', 'Wide'));
      body.appendChild(slider('Eyes', 'eyeSize', 'Small', 'Big'));
      body.appendChild(slider('Nose', 'noseSize', 'Small', 'Big'));
      body.appendChild(sw('Eye color', 'eye', EYE_SET));
      body.appendChild(seg('Makeup', 'makeup', MAKEUP));
      if (A.makeup !== 'none' && A.makeup !== 'rouge' && A.makeup !== 'liner') body.appendChild(sw('Makeup color', 'makeupColor', MAKEUP_COLORS));
    } else if (cur === 'hair') {
      body.appendChild(seg('Hairstyle', 'hairStyle', HAIR_STYLES));
      body.appendChild(sw('Hair color', 'hair', HERO_HAIR));
      body.appendChild(seg('Beard', 'beardStyle', BEARD_STYLES));
    } else if (cur === 'marks') {
      body.appendChild(seg('Scars', 'scar', SCARS));
      body.appendChild(seg('Tattoos', 'tattoo', TATTOOS));
      if (A.tattoo !== 'none') body.appendChild(sw('Tattoo color', 'tattooColor', TATTOO_COLORS));
      if (A.race === 'sylvan') body.appendChild(el('div', 'cz-note', 'Sylvan tattoos glow.'));
    } else if (cur === 'preset') {
      const rnd = el('button', 'btn', 'Randomize'); rnd.onclick = () => { st.app = randomApp(); changed(); sfx.play('click'); };
      body.appendChild(rnd);
      const code = encodeApp(A);
      const row = el('div', 'cz-row'); row.appendChild(el('div', 'lbl', 'Share code'));
      const out = el('input', 'cz-code'); out.readOnly = true; out.value = code; out.setAttribute('aria-label', 'Preset code'); out.onclick = () => out.select();
      const cp = el('button', 'btn small', 'Copy'); cp.onclick = () => { out.select(); try { navigator.clipboard?.writeText(code); } catch { /* copy by hand */ } cp.textContent = 'Copied'; };
      row.appendChild(out); row.appendChild(cp); body.appendChild(row);
      const row2 = el('div', 'cz-row'); row2.appendChild(el('div', 'lbl', 'Use a code'));
      const inp = el('input', 'cz-code'); inp.placeholder = 'AET1.…'; inp.setAttribute('aria-label', 'Paste a preset code');
      const ap = el('button', 'btn small', 'Apply'); ap.onclick = () => { const a = decodeApp(inp.value); if (!a) { inp.style.borderColor = '#ff5a4a'; return; } st.app = a; changed(); };
      row2.appendChild(inp); row2.appendChild(ap); body.appendChild(row2);
      let saved = []; try { saved = JSON.parse(localStorage.getItem(PRESET_KEY) || '[]'); } catch { saved = []; }
      const row3 = el('div', 'cz-row'); row3.appendChild(el('div', 'lbl', `Saved presets (${saved.length}/6)`));
      const sv = el('button', 'btn small green', 'Save current'); sv.onclick = () => { saved = [code, ...saved.filter((x) => x !== code)].slice(0, 6); try { localStorage.setItem(PRESET_KEY, JSON.stringify(saved)); } catch { /* storage off */ } render(); };
      row3.appendChild(sv); body.appendChild(row3);
      const pl = el('div', 'cz-presets');
      saved.forEach((c, i) => { const b = el('button', 'btn small gray', `Preset ${i + 1}`); b.onclick = () => { const a = decodeApp(c); if (a) { st.app = a; changed(); } }; pl.appendChild(b); });
      body.appendChild(pl);
    }
  };
  render();
  return { render };
}

