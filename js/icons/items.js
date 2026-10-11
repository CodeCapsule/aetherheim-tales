// Item & equipment icons (SVG, 64x64). Ornate "_l" variants are used for Unique and Legendary gear.
const INK = 'stroke="#24160f" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
const INK2 = 'stroke="#24160f" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"';
const stops = (c) => c.map((s, i) => `<stop offset="${(i / (c.length - 1)).toFixed(2)}" stop-color="${s}"/>`).join('');
const lg = (id, c, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops(c)}</linearGradient>`;
const rg = (id, c, cx = '40%', cy = '35%') => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="65%">${stops(c)}</radialGradient>`;
const svg = (defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${defs}</defs>${body}</svg>`;
const spark = (x, y, s = 4, fill = '#fff') => `<path d="M${x} ${y - s}Q${x + s * 0.2} ${y - s * 0.2} ${x + s} ${y}Q${x + s * 0.2} ${y + s * 0.2} ${x} ${y + s}Q${x - s * 0.2} ${y + s * 0.2} ${x - s} ${y}Q${x - s * 0.2} ${y - s * 0.2} ${x} ${y - s}Z" fill="${fill}"/>`;
const aura = (k, c) => ({ def: `<radialGradient id="${k}-au" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${c}" stop-opacity=".85"/><stop offset=".55" stop-color="${c}" stop-opacity=".35"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`, el: `<circle cx="32" cy="32" r="31" fill="url(#${k}-au)"/>` });

// ---------------------------------------------------------------- consumables
const hp_potion = svg(
  lg('hp-l', ['#ff9a8a', '#f0283a', '#9a0c24']) + lg('hp-k', ['#e8a86a', '#9a5a2a']),
  `<rect x="26" y="15" width="12" height="12" fill="#e8f8ff" ${INK}/>
<circle cx="32" cy="41" r="18" fill="url(#hp-l)" ${INK}/>
<rect x="23.5" y="6" width="17" height="10" rx="3" fill="url(#hp-k)" ${INK}/>
<path d="M32 49C26 44 23.5 41.5 23.5 38.5C23.5 35.5 27 34 29 36L32 39L35 36C37 34 40.5 35.5 40.5 38.5C40.5 41.5 38 44 32 49Z" fill="#fff4f4" stroke="#7a0a18" stroke-width="1.5" stroke-linejoin="round"/>
<path d="M19 37C20 31 24 27.5 28 26.5" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" opacity=".9"/>`);

const mp_potion = svg(
  lg('mp-l', ['#8ae0ff', '#2a8aff', '#1a3ab8']) + lg('mp-k', ['#e8a86a', '#9a5a2a']),
  `<path d="M27 12H37V25L50 51C52 55 49 58 45 58H19C15 58 12 55 14 51L27 25Z" fill="url(#mp-l)" ${INK}/>
<rect x="24" y="5" width="16" height="9" rx="3" fill="url(#mp-k)" ${INK}/>
<path d="M18 50L23.5 39" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" opacity=".9"/>
${spark(35, 45, 6, '#f0faff')}${spark(29, 52, 3, '#cfeaff')}`);

const pet_egg = svg(
  rg('egg-b', ['#fffdf2', '#fbe8c8', '#e8c89a']) + aura('egg', '#ffe8a8').def,
  `${aura('egg', '#ffe8a8').el}<ellipse cx="32" cy="35" rx="17" ry="22" fill="url(#egg-b)" ${INK}/>
<circle cx="25" cy="30" r="4" fill="#ffa8c8"/><circle cx="38" cy="25" r="3" fill="#8ae8c8"/><circle cx="37" cy="41" r="4.5" fill="#a8c8ff"/><circle cx="26" cy="45" r="3" fill="#ffd27a"/>
<path d="M22 22C24 17 27 15 30 14" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round"/>
${spark(51, 14, 4)}${spark(12, 50, 3)}`);

const glowcap = svg(
  lg('gc-c', ['#c8fbff', '#4ae0f0', '#1a8ab8']) + lg('gc-s', ['#fffaf0', '#e8d8b8']) + aura('gc', '#6af0ff').def,
  `${aura('gc', '#6af0ff').el}<path d="M27 33H37L39 55C39 57 37 58 35 58H29C27 58 25 57 25 55Z" fill="url(#gc-s)" ${INK}/>
<path d="M8 34C10 15 22 8 32 8C42 8 54 15 56 34C46 39 18 39 8 34Z" fill="url(#gc-c)" ${INK}/>
<circle cx="22" cy="21" r="3.5" fill="#f0ffff"/><circle cx="37" cy="17" r="2.6" fill="#f0ffff"/><circle cx="45" cy="27" r="3" fill="#f0ffff"/><circle cx="29" cy="30" r="2.2" fill="#f0ffff"/>
<path d="M14 26C16 19 20 15 25 13" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>`);

const exp_scroll = svg(
  lg('es-p', ['#fff8e0', '#f0d8a0', '#d8b070']) + lg('es-r', ['#ffe07a', '#e0a020']) + aura('es', '#fff0a0').def,
  `${aura('es', '#fff0a0').el}<rect x="15" y="14" width="34" height="36" fill="url(#es-p)" ${INK}/>
<rect x="10" y="8" width="44" height="9" rx="4.5" fill="#e8c890" ${INK}/>
<rect x="10" y="47" width="44" height="9" rx="4.5" fill="#e8c890" ${INK}/>
<path d="M21 25H43M21 31H40M21 37H43" stroke="#b0884a" stroke-width="2.4" stroke-linecap="round"/>
<path d="M29 40H35V58L32 55L29 58Z" fill="url(#es-r)" ${INK2}/>
<circle cx="32" cy="41" r="5" fill="url(#es-r)" ${INK2}/>
${spark(50, 31, 4.5, '#fffbe0')}`);

const dungeon_ticket = svg(
  rg('dt-b', ['#ffe0a8', '#c88a3a', '#7a4a1a']) + rg('dt-g', ['#f0c8ff', '#a050e8', '#4a1a8a']),
  `<circle cx="32" cy="32" r="25" fill="url(#dt-b)" ${INK}/>
<circle cx="32" cy="32" r="18" fill="none" stroke="#7a4a1a" stroke-width="2.4"/>
<path d="M22 46V31C22 24 27 20 32 20C37 20 42 24 42 31V46Z" fill="#2a1a3a" ${INK2}/>
<path d="M27 46V33C27 29 29 27 32 27C35 27 37 29 37 33V46Z" fill="url(#dt-g)"/>
<path d="M32 9L35 13L32 17L29 13Z" fill="url(#dt-g)" ${INK2}/>
<path d="M17 24C19 19 23 15.5 27 14" fill="none" stroke="#fff6dc" stroke-width="2.5" stroke-linecap="round"/>`);

const loot_bag = svg(
  rg('lb-b', ['#e8b070', '#a8682e', '#6a3a14']) + lg('lb-c', ['#fff4a0', '#f0b020']),
  `<path d="M20 24C11 34 10 52 20 57H44C54 52 53 34 44 24Z" fill="url(#lb-b)" ${INK}/>
<path d="M22 24L17 12L26 17L32 9L38 17L47 12L42 24Z" fill="#c88a4a" ${INK}/>
<path d="M19 24C27 27 37 27 45 24" fill="none" stroke="#e8c070" stroke-width="4" stroke-linecap="round"/>
<path d="M19 24C27 27 37 27 45 24" fill="none" stroke="#24160f" stroke-width="1.2" stroke-linecap="round"/>
<ellipse cx="40" cy="45" rx="7" ry="7" fill="url(#lb-c)" ${INK2}/>
<path d="M40 41V49" stroke="#b07a10" stroke-width="2"/>
<path d="M18 38C18 33 20 30 22 28" fill="none" stroke="#ffe8c8" stroke-width="2.6" stroke-linecap="round"/>`);

const coin = (x, y, id) => `<ellipse cx="${x}" cy="${y + 3}" rx="11" ry="4.5" fill="#b07a10" ${INK2}/><ellipse cx="${x}" cy="${y}" rx="11" ry="4.5" fill="url(#${id})" ${INK2}/><ellipse cx="${x}" cy="${y}" rx="6" ry="2.2" fill="none" stroke="#c8901a" stroke-width="1.6"/>`;
const gold = svg(
  lg('gd-c', ['#fff6b0', '#f0c030', '#d89010']),
  `${coin(22, 50, 'gd-c')}${coin(22, 43, 'gd-c')}${coin(22, 36, 'gd-c')}${coin(42, 51, 'gd-c')}${coin(42, 44, 'gd-c')}${coin(32, 54, 'gd-c')}
<circle cx="44" cy="22" r="12" fill="url(#gd-c)" ${INK}/><circle cx="44" cy="22" r="7" fill="none" stroke="#c8901a" stroke-width="2"/>
<path d="M44 17V27M41 19.5H46C47.5 19.5 47.5 22 46 22H42C40.5 22 40.5 24.5 42 24.5H47" fill="none" stroke="#a8700a" stroke-width="1.8" stroke-linecap="round"/>
${spark(16, 18, 4.5)}${spark(56, 38, 3)}`);

const diamond = svg(
  lg('dm-a', ['#e8fcff', '#7ad8ff', '#2a7af0']) + lg('dm-b', ['#a8e8ff', '#1a5ad8']),
  `<path d="M10 24L20 10H44L54 24L32 58Z" fill="url(#dm-a)"/>
<path d="M20 10L26 24L32 10ZM32 10L38 24L44 10Z" fill="#f4feff"/>
<path d="M10 24L26 24L32 58Z" fill="#5ab8ff"/><path d="M38 24L54 24L32 58Z" fill="url(#dm-b)"/><path d="M26 24H38L32 58Z" fill="#8ad8ff"/>
<path d="M10 24H54M20 10L26 24L32 10L38 24L44 10" fill="none" stroke="#24160f" stroke-width="1.8" stroke-linejoin="round"/>
<path d="M10 24L20 10H44L54 24L32 58Z" fill="none" ${INK}/>
${spark(46, 34, 4.5)}${spark(16, 46, 3)}`);

// ---------------------------------------------------------------- equipment
// Each builder returns [defs, body]; `l` = ornate Unique/Legendary version.
function sword(k, l) {
  const blade = l ? ['#ffffff', '#ffe9a8', '#e8b440'] : ['#ffffff', '#d8e4f4', '#8a9ab8'];
  const guard = l ? ['#fff3a0', '#f0b020', '#a86a08'] : ['#e8c070', '#a87a3a'];
  const defs = lg(`${k}-bl`, blade, 1, 0) + lg(`${k}-gd`, guard) + (l ? aura(k, '#ffd84a').def : '');
  const body = `${l ? aura(k, '#ffd84a').el : ''}<g transform="rotate(45 32 32)">
<path d="M32 2L37 9V41H27V9Z" fill="url(#${k}-bl)" ${INK}/>
<path d="M32 6V38" stroke="${l ? '#e89a10' : '#9aaac8'}" stroke-width="1.6"/>
${l ? `<path d="M15 40C18 36 23 38 27 41H37C41 38 46 36 49 40C46 44 41 46 37 45H27C23 46 18 44 15 40Z" fill="url(#${k}-gd)" ${INK}/><circle cx="32" cy="43" r="3.5" fill="#ff3a6a" ${INK2}/>`
    : `<rect x="19" y="40" width="26" height="6" rx="2.5" fill="url(#${k}-gd)" ${INK}/>`}
<rect x="29" y="46" width="6" height="11" rx="1.5" fill="${l ? '#6a2a8a' : '#6a3a1a'}" ${INK}/>
<circle cx="32" cy="59.5" r="3.6" fill="url(#${k}-gd)" ${INK2}/>
<path d="M29.5 12V34" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".9"/></g>
${l ? spark(48, 13, 5) + spark(14, 44, 3.5) : spark(46, 15, 3.5)}`;
  return svg(defs, body);
}
function daggers(k, l) {
  const blade = l ? ['#ffffff', '#c8ffe8', '#3ad0a0'] : ['#ffffff', '#d8e8f4', '#8a9ab8'];
  const defs = lg(`${k}-bl`, blade, 1, 0) + lg(`${k}-gd`, l ? ['#e8c8ff', '#9a4ae8'] : ['#6ad8b0', '#2a8a6a']) + (l ? aura(k, '#5af0c0').def : '');
  const dagger = (rot) => `<g transform="rotate(${rot} 32 32)">
<path d="M32 4L36 10V33H28V10Z" fill="url(#${k}-bl)" ${INK}/>
<path d="M22 33H42L39 38H25Z" fill="url(#${k}-gd)" ${INK2}/>
<rect x="29.2" y="38" width="5.6" height="12" rx="1.5" fill="#2a2030" ${INK2}/>
<circle cx="32" cy="52.5" r="3" fill="url(#${k}-gd)" ${INK2}/>
<path d="M30 12V29" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></g>`;
  return svg(defs, `${l ? aura(k, '#5af0c0').el : ''}${dagger(-32)}${dagger(32)}${l ? spark(32, 10, 5) + spark(12, 50, 3.5) + spark(52, 50, 3.5) : ''}`);
}
function staff(k, l) {
  const orb = l ? ['#ffffff', '#ffe07a', '#ff5a1a', '#a01a0a'] : ['#fff0c8', '#ffa040', '#d8400a'];
  const defs = rg(`${k}-ob`, orb) + lg(`${k}-wd`, l ? ['#5a2a7a', '#2a1040'] : ['#c88a4a', '#6a3a14'], 1, 0) + lg(`${k}-gd`, ['#fff3a0', '#e0a020']) + aura(k, l ? '#ff8a2a' : '#ffb060').def;
  const body = `${l ? aura(k, '#ff8a2a').el : `<circle cx="44" cy="18" r="16" fill="url(#${k}-au)"/>`}
<path d="M11 57L40 22" stroke="#24160f" stroke-width="9" stroke-linecap="round"/><path d="M11 57L40 22" stroke="url(#${k}-wd)" stroke-width="4.5" stroke-linecap="round"/>
${l ? `<path d="M37 16C33 10 37 4 44 3C40 7 41 11 44 13M51 25C57 29 61 25 61 18C57 22 53 21 51 18" fill="none" stroke="url(#${k}-gd)" stroke-width="3.5" stroke-linecap="round"/>` : `<path d="M35 18C32 13 35 8 41 7" fill="none" stroke="#e0a020" stroke-width="3" stroke-linecap="round"/>`}
<circle cx="44" cy="18" r="${l ? 10 : 8.5}" fill="url(#${k}-ob)" ${INK}/>
<path d="M17 50L21 45M24 41.5L27 38" stroke="url(#${k}-gd)" stroke-width="3" stroke-linecap="round"/>
<circle cx="41" cy="14.5" r="2.4" fill="#fff"/>${l ? spark(56, 40, 4.5) + spark(16, 22, 3.5) : ''}`;
  return svg(defs, body);
}
function scepter(k, l) {
  const defs = lg(`${k}-rd`, ['#fff3a0', '#e8a820', '#9a6408'], 1, 0) + lg(`${k}-cr`, l ? ['#ffffff', '#a8f0ff', '#3a8aff', '#8a3aff'] : ['#e8fbff', '#6ad0ff', '#2a7ae8']) + aura(k, l ? '#7ad8ff' : '#9ae0ff').def;
  const body = `${l ? aura(k, '#7ad8ff').el : `<circle cx="42" cy="20" r="15" fill="url(#${k}-au)"/>`}
<path d="M12 56L36 28" stroke="#24160f" stroke-width="8" stroke-linecap="round"/><path d="M12 56L36 28" stroke="url(#${k}-rd)" stroke-width="3.8" stroke-linecap="round"/>
<path d="M30 27C24 22 22 15 26 10C28 16 32 19 36 21Z" fill="#fff" ${INK2}/>
<path d="M44 33C49 38 56 39 60 35C54 34 50 30 48 26Z" fill="#fff" ${INK2}/>
<path d="M42 6L50 16L44 30L35 22Z" fill="url(#${k}-cr)" ${INK}/>
<path d="M42 6L44 30M35 22L50 16" stroke="#24160f" stroke-width="1.4" opacity=".6"/>
${l ? `<circle cx="36" cy="29" r="4" fill="#ff5aa8" ${INK2}/>` : `<circle cx="36" cy="29" r="3.2" fill="url(#${k}-rd)" ${INK2}/>`}
${spark(41, 13, 3)}${l ? spark(14, 30, 4) + spark(54, 50, 3.5) : ''}`;
  return svg(defs, body);
}
function helm(k, l) {
  const metal = l ? ['#fff8c8', '#f0c040', '#a86a08'] : ['#ffffff', '#c8d4e8', '#7a8aa8'];
  const defs = lg(`${k}-m`, metal) + lg(`${k}-pl`, l ? ['#ffb8f0', '#d03a9a'] : ['#8ac8ff', '#2a5ab8']) + (l ? aura(k, '#ffd84a').def : '');
  const body = `${l ? aura(k, '#ffd84a').el : ''}
<path d="M34 12C42 6 52 8 56 16C50 13 45 14 40 18Z" fill="url(#${k}-pl)" ${INK}/>
<path d="M12 40C12 24 20 14 32 14C44 14 52 24 52 40V50C52 54 49 56 46 56H18C15 56 12 54 12 50Z" fill="url(#${k}-m)" ${INK}/>
<path d="M18 36H46V42H18Z" fill="#2a2030" ${INK2}/>
<path d="M32 14V36M32 42V56" stroke="${l ? '#a86a08' : '#7a8aa8'}" stroke-width="2.4"/>
${l ? `<path d="M14 26L6 18L10 30M50 26L58 18L54 30" fill="#fff3a0" ${INK2}/><circle cx="32" cy="22" r="3.6" fill="#3ad0ff" ${INK2}/>` : ''}
<path d="M18 30C19 24 23 19 28 17" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>${l ? spark(54, 48, 4) : ''}`;
  return svg(defs, body);
}
function armor(k, l) {
  const plate = l ? ['#fffbe0', '#f0c040', '#b07010'] : ['#ffffff', '#c8d4e8', '#7a8aa8'];
  const defs = lg(`${k}-p`, plate) + lg(`${k}-c`, l ? ['#c87aff', '#5a2aa8'] : ['#6a9aff', '#2a4aa8']) + (l ? aura(k, '#ffd84a').def : '');
  const body = `${l ? aura(k, '#ffd84a').el : ''}
<path d="M20 12L26 9C28 13 36 13 38 9L44 12L56 20L52 30L46 28V54C40 58 24 58 18 54V28L12 30L8 20Z" fill="url(#${k}-c)" ${INK}/>
<path d="M22 20C26 24 38 24 42 20V44C38 48 26 48 22 44Z" fill="url(#${k}-p)" ${INK}/>
<path d="M8 20L20 12L22 22L12 30ZM56 20L44 12L42 22L52 30Z" fill="url(#${k}-p)" ${INK2}/>
<rect x="18" y="45" width="28" height="6" rx="2" fill="#7a4a2a" ${INK2}/><rect x="29" y="44" width="6" height="8" rx="1.5" fill="#ffd84a" ${INK2}/>
${l ? `<path d="M32 26L36 32L32 38L28 32Z" fill="#ff5a8a" ${INK2}/>${spark(52, 44, 4)}` : `<path d="M32 26V40" stroke="#7a8aa8" stroke-width="2"/>`}
<path d="M25 24C26 28 26 33 25 37" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`;
  return svg(defs, body);
}
function boots(k, l) {
  const leather = l ? ['#e8c8ff', '#9a5ae8', '#4a1a8a'] : ['#e8a868', '#9a5a2a', '#5a2a10'];
  const defs = lg(`${k}-l`, leather) + lg(`${k}-g`, ['#fff3a0', '#e0a020']) + (l ? aura(k, '#c8a0ff').def : '');
  const body = `${l ? aura(k, '#c8a0ff').el : ''}
<path d="M20 8H40V36L54 42C58 44 58 52 54 54H16C13 54 12 52 12 49V40C14 36 18 34 20 32Z" fill="url(#${k}-l)" ${INK}/>
<path d="M18 8H42V16H18Z" fill="${l ? '#fff3a0' : '#c88a4a'}" ${INK2}/>
<path d="M12 49H58" stroke="#24160f" stroke-width="2.4"/><path d="M12 50V54H56C57 53 58 52 58 50Z" fill="#3a2010"/>
<rect x="24" y="26" width="13" height="7" rx="2" fill="url(#${k}-g)" ${INK2}/>
${l ? `<path d="M40 22C48 18 54 20 58 26C52 24 48 26 44 30Z" fill="#fff" ${INK2}/>${spark(14, 22, 4)}` : ''}
<path d="M24 19V30" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>`;
  return svg(defs, body);
}
function necklace(k, l) {
  const gem = l ? ['#ffffff', '#7affb0', '#1aa86a'] : ['#ffd0e0', '#ff4a7a', '#a01a40'];
  const defs = lg(`${k}-g`, gem) + lg(`${k}-c`, ['#fff3a0', '#e0a020']) + aura(k, l ? '#7affb0' : '#ff8ab0').def;
  let beads = '';
  for (let i = 0; i <= 10; i++) { const a = Math.PI * (0.08 + 0.84 * i / 10); beads += `<circle cx="${(32 - Math.cos(a) * 22).toFixed(1)}" cy="${(12 + Math.sin(a) * 22).toFixed(1)}" r="2.6" fill="url(#${k}-c)" stroke="#24160f" stroke-width="1.4"/>`; }
  const body = `${l ? aura(k, '#7affb0').el : ''}${beads}
<path d="M32 30L44 42L32 60L20 42Z" fill="url(#${k}-g)" ${INK}/>
<path d="M20 42H44M32 30L28 42L32 60L36 42Z" fill="none" stroke="#24160f" stroke-width="1.4" opacity=".55"/>
<circle cx="32" cy="31" r="4" fill="url(#${k}-c)" ${INK2}/>
${l ? `<path d="M14 40C10 36 10 30 14 27M50 40C54 36 54 30 50 27" fill="none" stroke="url(#${k}-c)" stroke-width="3" stroke-linecap="round"/>${spark(48, 52, 4)}` : ''}
<path d="M26 40L31 35" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`;
  return svg(defs, body);
}
function ring(k, l) {
  const defs = lg(`${k}-b`, ['#fff8c0', '#f0c030', '#a86a08']) + lg(`${k}-g`, l ? ['#ffffff', '#ff9ad0', '#c81a7a'] : ['#e8fbff', '#4ab8ff', '#1a4ab8']) + (l ? aura(k, '#ff9ad0').def : '');
  const body = `${l ? aura(k, '#ff9ad0').el : ''}
<ellipse cx="32" cy="40" rx="20" ry="16" fill="none" stroke="#24160f" stroke-width="12"/>
<ellipse cx="32" cy="40" rx="20" ry="16" fill="none" stroke="url(#${k}-b)" stroke-width="7"/>
<path d="M20 30C24 26 28 25 32 25" fill="none" stroke="#fffbe0" stroke-width="2" stroke-linecap="round"/>
${l ? `<path d="M20 26L24 14L32 20L40 14L44 26Z" fill="url(#${k}-b)" ${INK2}/>` : `<path d="M24 26L28 18H36L40 26Z" fill="url(#${k}-b)" ${INK2}/>`}
<path d="M32 4L41 13L32 24L23 13Z" fill="url(#${k}-g)" ${INK}/>
<path d="M23 13H41M32 4L29 13L32 24L35 13Z" fill="none" stroke="#24160f" stroke-width="1.3" opacity=".55"/>
${spark(37, 9, 2.6)}${l ? spark(52, 50, 4) + spark(12, 22, 3) : ''}`;
  return svg(defs, body);
}

export const ITEM_ICONS = {
  hp_potion, mp_potion, pet_egg, glowcap, exp_scroll, dungeon_ticket, loot_bag, gold, diamond,
  w_sword: sword('ws', false), w_daggers: daggers('wd', false), w_staff: staff('wst', false), w_scepter: scepter('wsc', false),
  helm: helm('hm', false), armor: armor('ar', false), boots: boots('bt', false), necklace: necklace('nk', false), ring: ring('rg', false),
  w_sword_l: sword('wsl', true), w_daggers_l: daggers('wdl', true), w_staff_l: staff('wstl', true), w_scepter_l: scepter('wscl', true),
  helm_l: helm('hml', true), armor_l: armor('arl', true), boots_l: boots('btl', true), necklace_l: necklace('nkl', true), ring_l: ring('rgl', true),
};
