// Icons for the class skills (generated from a glyph library: one badge per skill, framed by type and tinted by
// class), the four newer class emblems and their weapons. Same ink style as the hand-made set.
import { CLASSES, SKILL_BY_ID, BASIC } from '../data-classes.js';

const INK = '#24160f';
const S = (w = 2.6) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const svg = (defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${defs}</defs>${body}</svg>`;
const lg = (id, c, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${c.map((s, i) => `<stop offset="${(i / (c.length - 1)).toFixed(2)}" stop-color="${s}"/>`).join('')}</linearGradient>`;
const rg = (id, c) => `<radialGradient id="${id}" cx="40%" cy="35%" r="70%">${c.map((s, i) => `<stop offset="${(i / (c.length - 1)).toFixed(2)}" stop-color="${s}"/>`).join('')}</radialGradient>`;
const mix = (hex, t, to = '#ffffff') => {
  const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16);
  const c = [16, 8, 0].map((sh) => Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
};
const spark = (x, y, s = 4, fill = '#fff') => `<path d="M${x} ${y - s}Q${x + s * 0.2} ${y - s * 0.2} ${x + s} ${y}Q${x + s * 0.2} ${y + s * 0.2} ${x} ${y + s}Q${x - s * 0.2} ${y + s * 0.2} ${x - s} ${y}Q${x - s * 0.2} ${y - s * 0.2} ${x} ${y - s}Z" fill="${fill}"/>`;

// ---------------------------------------------------------------- glyphs (white shapes, tint = accent)
const W = '#ffffff';
const GLYPH = {
  shield: (a) => `<path d="M32 10L48 15C48 33 43 44 32 53C21 44 16 33 16 15Z" fill="${W}" ${S()}/><path d="M32 17V45M22 26H42" stroke="${a}" stroke-width="4" stroke-linecap="round"/>`,
  armor: (a) => `<path d="M20 14L27 11C29 15 35 15 37 11L44 14L50 24L44 27V52H20V27L14 24Z" fill="${W}" ${S()}/><path d="M26 30H38M26 38H38M26 46H38" stroke="${a}" stroke-width="3" stroke-linecap="round"/>`,
  roar: (a) => `<path d="M14 26C14 17 22 12 30 14C36 15 40 21 39 28L30 30L38 34C36 42 28 46 21 43C16 41 14 34 14 26Z" fill="${W}" ${S()}/><path d="M44 22C48 25 48 33 44 36M48 17C55 23 55 35 48 41" fill="none" stroke="${a}" stroke-width="3.5" stroke-linecap="round"/><circle cx="24" cy="23" r="2.5" fill="${INK}"/>`,
  wall: (a) => `<path d="M10 22H54V50H10Z" fill="${W}" ${S()}/><path d="M10 31H54M10 40H54M22 22V31M38 22V31M30 31V40M46 31V40M18 40V50M38 40V50" stroke="${a}" stroke-width="2.4"/><path d="M10 22L14 14H22L26 22M38 22L42 14H50L54 22" fill="${W}" ${S()}/>`,
  boot: (a) => `<path d="M22 10H36V36L50 40C54 41 55 46 52 49H18V40C18 30 22 24 22 10Z" fill="${W}" ${S()}/><path d="M22 18H36M20 49H52" stroke="${a}" stroke-width="3.5" stroke-linecap="round"/><path d="M8 26H16M6 34H14" stroke="${a}" stroke-width="3" stroke-linecap="round"/>`,
  banner: (a) => `<path d="M18 8V56" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M18 8V56" stroke="#d8b070" stroke-width="2.4" stroke-linecap="round"/><path d="M20 11H50L44 21L50 31H20Z" fill="${a}" ${S()}/><circle cx="33" cy="21" r="4" fill="${W}" ${S(1.8)}/>`,
  eye: (a) => `<path d="M6 32C14 20 24 15 32 15C40 15 50 20 58 32C50 44 40 49 32 49C24 49 14 44 6 32Z" fill="${W}" ${S()}/><circle cx="32" cy="32" r="10" fill="${a}" ${S(2)}/><circle cx="32" cy="32" r="4.5" fill="${INK}"/><circle cx="29" cy="29" r="2" fill="${W}"/>`,
  leap: (a) => `<path d="M10 52C14 30 26 16 42 14" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M10 52C14 30 26 16 42 14" fill="none" stroke="${W}" stroke-width="4.5" stroke-linecap="round"/><path d="M38 6L52 14L39 22Z" fill="${a}" ${S()}/><path d="M40 52H58" stroke="${a}" stroke-width="4" stroke-linecap="round"/>`,
  heart: (a) => `<path d="M32 53C18 43 9 34 9 24C9 16 15 11 22 11C27 11 30 14 32 18C34 14 37 11 42 11C49 11 55 16 55 24C55 34 46 43 32 53Z" fill="${a}" ${S()}/><path d="M17 22C18 18 20 17 23 16.5" fill="none" stroke="${W}" stroke-width="3" stroke-linecap="round"/><path d="M32 24V40M24 32H40" stroke="${W}" stroke-width="4" stroke-linecap="round"/>`,
  quake: (a) => `<path d="M6 42L18 38L24 44L34 36L44 42L58 38V54H6Z" fill="${W}" ${S()}/><path d="M24 44L28 52M34 36L32 46M44 42L48 50" stroke="${INK}" stroke-width="2"/><path d="M16 30L12 18M26 28L26 14M38 28L42 16M48 32L54 22" stroke="${a}" stroke-width="3.5" stroke-linecap="round"/>`,
  tower: (a) => `<path d="M20 22H44V54H20Z" fill="${W}" ${S()}/><path d="M16 22V12H22V16H28V12H36V16H42V12H48V22Z" fill="${W}" ${S()}/><path d="M28 54V42C28 38 36 38 36 42V54" fill="${a}" ${S(2)}/><rect x="29" y="27" width="6" height="7" fill="${a}" ${S(1.6)}/>`,
  dome: (a) => `<path d="M8 50C8 30 19 16 32 16C45 16 56 30 56 50Z" fill="${a}" opacity=".85" ${S()}/><path d="M16 46C16 32 23 22 32 22" fill="none" stroke="${W}" stroke-width="3" stroke-linecap="round"/><path d="M4 50H60" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="42" r="5" fill="${W}" ${S(1.8)}/>`,
  mirror: (a) => `<path d="M32 8L48 13C48 30 43 41 32 49C21 41 16 30 16 13Z" fill="${a}" ${S()}/><path d="M24 18L40 34M22 28L34 40" stroke="${W}" stroke-width="3" stroke-linecap="round"/><path d="M50 40L58 36M50 48L58 52M10 40L4 36M10 48L4 52" stroke="${a}" stroke-width="3" stroke-linecap="round"/>`,
  crown: (a) => `<path d="M10 46L8 18L22 30L32 12L42 30L56 18L54 46Z" fill="#ffd84a" ${S()}/><path d="M10 46H54V54H10Z" fill="${a}" ${S()}/><circle cx="32" cy="34" r="4" fill="${W}" ${S(1.6)}/>`,
  wings: (a) => `<path d="M30 30C22 14 8 12 4 18C10 20 10 24 8 28C14 28 16 32 14 36C20 36 24 40 30 42Z" fill="${W}" ${S()}/><path d="M34 30C42 14 56 12 60 18C54 20 54 24 56 28C50 28 48 32 50 36C44 36 40 40 34 42Z" fill="${W}" ${S()}/><circle cx="32" cy="36" r="5" fill="${a}" ${S(2)}/>`,
  fist: (a) => `<path d="M16 26C16 20 20 18 24 18H44C48 18 50 21 50 25V40C50 48 44 54 36 54H28C20 54 16 48 16 40Z" fill="${W}" ${S()}/><path d="M24 18V30M32 18V30M40 18V30M16 34C22 32 26 34 28 38" fill="none" stroke="${INK}" stroke-width="2.2"/><path d="M8 20L12 24M6 32H11M8 44L12 40" stroke="${a}" stroke-width="3.5" stroke-linecap="round"/>`,
  sword: (a) => `<g transform="rotate(45 32 32)"><path d="M32 3L37 10V40H27V10Z" fill="${W}" ${S()}/><rect x="19" y="40" width="26" height="6" rx="2.5" fill="${a}" ${S()}/><rect x="29" y="46" width="6" height="11" fill="#6a3a1a" ${S()}/></g>`,
  skull: (a) => `<path d="M32 8C44 8 52 16 52 28C52 35 48 39 44 41V50H20V41C16 39 12 35 12 28C12 16 20 8 32 8Z" fill="${W}" ${S()}/><circle cx="24" cy="29" r="5.5" fill="${a}" ${S(2)}/><circle cx="40" cy="29" r="5.5" fill="${a}" ${S(2)}/><path d="M32 34L29 40H35Z" fill="${INK}"/><path d="M26 50V44M32 50V44M38 50V44" stroke="${INK}" stroke-width="2"/>`,
  spiral: (a) => `<path d="M32 32C32 29 36 29 36 32C36 37 28 38 27 32C26 25 36 22 41 27C47 33 43 44 33 45C22 46 16 37 18 27C20 16 33 11 43 15" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M32 32C32 29 36 29 36 32C36 37 28 38 27 32C26 25 36 22 41 27C47 33 43 44 33 45C22 46 16 37 18 27C20 16 33 11 43 15" fill="none" stroke="${a}" stroke-width="4" stroke-linecap="round"/>`,
  axe: (a) => `<path d="M33 8V58" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M33 8V58" stroke="#c8905a" stroke-width="4" stroke-linecap="round"/><path d="M33 14C22 8 12 14 12 26C12 32 15 36 18 38C22 32 27 30 33 30Z" fill="${W}" ${S()}/><path d="M33 14C44 8 54 14 54 26C54 32 51 36 48 38C44 32 39 30 33 30Z" fill="${W}" ${S()}/><path d="M16 26C17 20 21 16 26 15" fill="none" stroke="${a}" stroke-width="2.5" stroke-linecap="round"/>`,
  drop: (a) => `<path d="M32 6C40 20 50 29 50 40C50 50 42 57 32 57C22 57 14 50 14 40C14 29 24 20 32 6Z" fill="${a}" ${S()}/><path d="M21 42C22 48 26 51 31 52" fill="none" stroke="${W}" stroke-width="3.5" stroke-linecap="round"/>`,
  flame: (a) => `<path d="M32 4C36 14 48 20 48 36C48 47 41 56 32 56C23 56 16 47 16 36C16 28 20 24 24 20C24 28 27 31 30 31C28 22 30 12 32 4Z" fill="${a}" ${S()}/><path d="M32 30C36 36 40 39 40 45C40 50 36 53 32 53C28 53 24 50 24 45C24 40 28 37 32 30Z" fill="#fff7b0" stroke="${INK}" stroke-width="1.6"/>`,
  burst: (a) => `<path d="M32 4L37 23L56 14L44 30L60 38L41 40L46 58L32 45L18 58L23 40L4 38L20 30L8 14L27 23Z" fill="${a}" ${S()}/><circle cx="32" cy="33" r="7" fill="${W}" ${S(2)}/>`,
  wind: (a) => `<path d="M8 22H38C44 22 46 14 40 12C36 11 34 14 35 16M8 32H48C55 32 57 42 50 44C46 45 43 42 44 40M8 42H30C36 42 37 50 32 51" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M8 22H38C44 22 46 14 40 12C36 11 34 14 35 16M8 32H48C55 32 57 42 50 44C46 45 43 42 44 40M8 42H30C36 42 37 50 32 51" fill="none" stroke="${a}" stroke-width="4" stroke-linecap="round"/>`,
  venom: (a) => `<path d="M32 6C40 20 50 29 50 40C50 50 42 57 32 57C22 57 14 50 14 40C14 29 24 20 32 6Z" fill="#7aff4a" ${S()}/><circle cx="26" cy="40" r="4" fill="${W}" ${S(1.6)}/><circle cx="37" cy="45" r="3" fill="${W}" ${S(1.6)}/><circle cx="35" cy="33" r="2.4" fill="${W}" ${S(1.4)}/><path d="M48 12L56 6M52 20L60 18" stroke="${a}" stroke-width="3" stroke-linecap="round"/>`,
  cloud: (a) => `<path d="M14 44C7 44 6 34 13 32C12 24 22 20 27 26C29 16 44 15 46 26C54 24 59 33 53 38C58 42 54 48 49 46H14Z" fill="${W}" ${S()}/><path d="M18 52L16 58M30 52L28 58M42 52L40 58" stroke="${a}" stroke-width="3.5" stroke-linecap="round"/>`,
  web: (a) => `<path d="M32 6V58M6 32H58M13 13L51 51M51 13L13 51" stroke="${W}" stroke-width="3"/><path d="M32 18L42 22L46 32L42 42L32 46L22 42L18 32L22 22Z M32 28L36 30L37 32L36 34L32 36L28 34L27 32L28 30Z" fill="none" stroke="${a}" stroke-width="2.8" stroke-linejoin="round"/><circle cx="32" cy="32" r="3" fill="${INK}"/>`,
  star: (a) => `<path d="M32 6L39 23L57 24L43 36L48 54L32 44L16 54L21 36L7 24L25 23Z" fill="${a}" ${S()}/><path d="M24 28L30 27" stroke="${W}" stroke-width="3" stroke-linecap="round"/>`,
  moon: (a) => `<path d="M40 8C26 10 18 22 20 36C22 48 33 56 46 54C38 52 30 44 29 33C28 22 33 13 40 8Z" fill="${a}" ${S()}/>${spark(46, 20, 5, W)}${spark(52, 36, 3.5, W)}`,
  mask: (a) => `<path d="M8 22C18 16 46 16 56 22C56 34 50 42 42 42C37 42 35 36 32 36C29 36 27 42 22 42C14 42 8 34 8 22Z" fill="${a}" ${S()}/><path d="M16 27C19 25 24 25 26 28C22 31 18 31 16 27ZM48 27C45 25 40 25 38 28C42 31 46 31 48 27Z" fill="${W}" ${S(1.6)}/>`,
  dagger: (a) => `<g transform="rotate(40 32 32)"><path d="M32 4L37 12V36H27V12Z" fill="${W}" ${S()}/><path d="M21 36H43L40 41H24Z" fill="${a}" ${S()}/><rect x="29" y="41" width="6" height="12" fill="#2a2030" ${S()}/></g>`,
  flower: (a) => `${[0, 72, 144, 216, 288].map((r) => `<ellipse cx="32" cy="18" rx="7" ry="11" fill="${a}" ${S(2.2)} transform="rotate(${r} 32 32)"/>`).join('')}<circle cx="32" cy="32" r="7" fill="#ffe07a" ${S(2)}/>`,
  arrow: (a) => `<path d="M10 54L50 14" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M10 54L50 14" stroke="#d8b070" stroke-width="3" stroke-linecap="round"/><path d="M56 8L52 24L40 12Z" fill="${W}" ${S()}/><path d="M10 54L8 44M10 54L20 56M14 50L12 42M14 50L22 52" stroke="${a}" stroke-width="3.5" stroke-linecap="round"/>`,
  bow: (a) => `<path d="M18 6C40 14 46 50 18 58" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M18 6C40 14 46 50 18 58" fill="none" stroke="#c8905a" stroke-width="4" stroke-linecap="round"/><path d="M18 6V58" stroke="${W}" stroke-width="2"/><path d="M14 32H52" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M14 32H52" stroke="${a}" stroke-width="2.2" stroke-linecap="round"/><path d="M58 32L50 27V37Z" fill="${W}" ${S(1.8)}/>`,
  arrows: (a) => [-12, 0, 12].map((x) => `<g transform="translate(${x} ${Math.abs(x) * 0.4})"><path d="M32 54V16" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M32 54V16" stroke="#d8b070" stroke-width="2.4" stroke-linecap="round"/><path d="M32 8L37 18H27Z" fill="${W}" ${S(1.8)}/><path d="M29 54L32 48L35 54" fill="none" stroke="${a}" stroke-width="2.4"/></g>`).join(''),
  target: (a) => `<circle cx="32" cy="32" r="24" fill="${W}" ${S()}/><circle cx="32" cy="32" r="16" fill="${a}" ${S(2)}/><circle cx="32" cy="32" r="8" fill="${W}" ${S(2)}/><circle cx="32" cy="32" r="3" fill="${INK}"/>`,
  paw: (a) => `<path d="M32 30C42 30 48 40 46 48C44 54 38 52 32 52C26 52 20 54 18 48C16 40 22 30 32 30Z" fill="${a}" ${S()}/>${[[18, 26], [27, 16], [37, 16], [46, 26]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="5" ry="6.5" fill="${a}" ${S(2)}/>`).join('')}`,
  wolf: (a) => `<path d="M14 8L24 22H40L50 8L52 30C52 44 42 54 32 56C22 54 12 44 12 30Z" fill="${a}" ${S()}/><path d="M24 40C28 44 36 44 40 40L32 50Z" fill="${W}" ${S(1.8)}/><circle cx="24" cy="31" r="3" fill="${W}"/><circle cx="40" cy="31" r="3" fill="${W}"/><path d="M30 38H34" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
  bird: (a) => `<path d="M6 26C14 22 22 24 28 30C32 20 42 14 56 14C50 18 46 24 44 30C52 30 58 34 60 40C50 38 42 40 36 44C30 50 20 52 12 48C18 46 22 42 24 38C16 38 10 34 6 26Z" fill="${a}" ${S()}/><circle cx="40" cy="26" r="2.5" fill="${W}"/>`,
  sun: (a) => `${[0, 45, 90, 135, 180, 225, 270, 315].map((r) => `<path d="M32 2L36 12H28Z" fill="#ffd84a" ${S(1.8)} transform="rotate(${r} 32 32)"/>`).join('')}<circle cx="32" cy="32" r="15" fill="${a}" ${S()}/><circle cx="27" cy="27" r="4" fill="${W}" opacity=".8"/>`,
  book: (a) => `<path d="M8 16C16 12 26 12 32 18C38 12 48 12 56 16V52C48 48 38 48 32 54C26 48 16 48 8 52Z" fill="${W}" ${S()}/><path d="M32 18V54" stroke="${INK}" stroke-width="2.4"/><path d="M14 24C18 22 22 22 26 24M14 32C18 30 22 30 26 32M38 24C42 22 46 22 50 24M38 32C42 30 46 30 50 32" stroke="${a}" stroke-width="2.6" stroke-linecap="round"/>`,
  snow: (a) => `${[0, 60, 120].map((r) => `<g transform="rotate(${r} 32 32)"><path d="M32 6V58" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M32 6V58" stroke="${a}" stroke-width="3.4" stroke-linecap="round"/><path d="M26 12L32 18L38 12M26 52L32 46L38 52" fill="none" stroke="${W}" stroke-width="2.6" stroke-linecap="round"/></g>`).join('')}<circle cx="32" cy="32" r="5" fill="${W}" ${S(2)}/>`,
  bolt: (a) => `<path d="M36 4L14 36H30L24 60L50 24H34L42 4Z" fill="${a}" ${S()}/><path d="M33 10L24 26" stroke="${W}" stroke-width="3" stroke-linecap="round"/>`,
  swirl: (a) => `<path d="M10 32C10 20 20 12 32 12C44 12 52 22 46 30C42 36 32 34 32 28" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M10 32C10 20 20 12 32 12C44 12 52 22 46 30C42 36 32 34 32 28" fill="none" stroke="${a}" stroke-width="4" stroke-linecap="round"/><path d="M54 32C54 44 44 52 32 52C20 52 12 42 18 34C22 28 32 30 32 36" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M54 32C54 44 44 52 32 52C20 52 12 42 18 34C22 28 32 30 32 36" fill="none" stroke="${W}" stroke-width="4" stroke-linecap="round"/>`,
  meteor: (a) => `<path d="M6 6L34 30M14 4L38 24M4 16L30 36" stroke="${a}" stroke-width="4" stroke-linecap="round"/><circle cx="40" cy="40" r="15" fill="#8a6a5a" ${S()}/><circle cx="35" cy="36" r="3.5" fill="#5a4038"/><circle cx="45" cy="45" r="2.6" fill="#5a4038"/><path d="M30 46C33 51 38 53 43 53" fill="none" stroke="#ffb07a" stroke-width="3" stroke-linecap="round"/>`,
  orb: (a) => `<circle cx="32" cy="32" r="20" fill="${a}" ${S()}/><circle cx="32" cy="32" r="12" fill="${W}" opacity=".35"/><path d="M22 24C24 19 28 17 32 16" fill="none" stroke="${W}" stroke-width="3.5" stroke-linecap="round"/>${spark(50, 12, 5, W)}${spark(12, 50, 4, W)}`,
  spark: (a) => `${spark(32, 32, 22, a)}<path d="M32 10Q34 30 54 32Q34 34 32 54Q30 34 10 32Q30 30 32 10Z" fill="none" stroke="${INK}" stroke-width="2.4"/>${spark(50, 12, 5, W)}${spark(14, 50, 4, W)}`,
  wave: (a) => `<path d="M4 40C12 26 22 20 32 22C26 26 26 34 32 36C38 38 46 34 48 28C52 32 56 38 60 40V54H4Z" fill="${a}" ${S()}/><path d="M10 48C18 44 26 44 34 48" fill="none" stroke="${W}" stroke-width="3" stroke-linecap="round"/>`,
  leaf: (a) => `<path d="M12 52C10 30 24 12 54 10C54 36 40 54 12 52Z" fill="${a}" ${S()}/><path d="M12 52C24 40 34 30 46 18" fill="none" stroke="${W}" stroke-width="3" stroke-linecap="round"/>`,
  spirit: (a) => `<path d="M32 6C42 14 50 22 50 34C50 46 42 54 32 54C26 54 20 50 18 44C14 50 10 52 6 52C12 48 14 42 14 34C14 22 22 14 32 6Z" fill="${a}" ${S()}/><circle cx="27" cy="32" r="3.5" fill="${INK}"/><circle cx="38" cy="32" r="3.5" fill="${INK}"/><path d="M28 41C31 43 34 43 37 41" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`,
  link: (a) => `<rect x="6" y="22" width="30" height="20" rx="10" fill="none" stroke="${INK}" stroke-width="9"/><rect x="6" y="22" width="30" height="20" rx="10" fill="none" stroke="${a}" stroke-width="4.5"/><rect x="28" y="22" width="30" height="20" rx="10" fill="none" stroke="${INK}" stroke-width="9"/><rect x="28" y="22" width="30" height="20" rx="10" fill="none" stroke="${W}" stroke-width="4.5"/>`,
  claw: (a) => `${[-12, 0, 12].map((x) => `<path d="M${22 + x} 8C${14 + x} 24 ${18 + x} 44 ${34 + x} 58" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M${22 + x} 8C${14 + x} 24 ${18 + x} 44 ${34 + x} 58" fill="none" stroke="${a}" stroke-width="4" stroke-linecap="round"/>`).join('')}`,
  tentacle: (a) => `<path d="M14 58C14 40 30 40 30 28C30 18 22 14 26 8C40 10 46 22 44 34C42 46 28 46 30 58Z" fill="${a}" ${S()}/>${[[30, 48], [36, 38], [38, 26], [34, 16]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="${W}" ${S(1.4)}/>`).join('')}`,
  rune: (a) => `<path d="M32 5L54 18V46L32 59L10 46V18Z" fill="#5a6a8a" ${S()}/><path d="M24 20L32 44L40 20M26 32H38" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 20L32 44L40 20M26 32H38" fill="none" stroke="${a}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
};

// a skill badge: square for actives, round for passives, gold star frame for ultimates
function skillIcon(id, sk, color) {
  const k = 'sk' + id.replace(/[^a-z0-9]/gi, '');
  const bg = [mix(color, 0.35), color, mix(color, 0.55, '#000000')];
  const accent = mix(color, 0.15);
  const glyph = (GLYPH[sk.g] || GLYPH.spark)(accent);
  let frame;
  if (sk.type === 'passive') frame = `<circle cx="32" cy="32" r="29" fill="url(#${k}-b)" ${S(3)}/><circle cx="32" cy="32" r="25" fill="none" stroke="${mix(color, 0.6)}" stroke-width="1.6" opacity=".7"/>`;
  else if (sk.type === 'ultimate') frame = `<path d="M32 2L40 10L52 8L54 20L62 28L56 38L58 50L46 54L38 62L28 56L16 58L12 46L2 38L8 28L6 16L18 12L26 4Z" fill="#ffd84a" ${S(2.6)}/><circle cx="32" cy="32" r="22" fill="url(#${k}-b)" ${S(2.4)}/>`;
  else frame = `<rect x="3" y="3" width="58" height="58" rx="12" fill="url(#${k}-b)" ${S(3)}/><rect x="7" y="7" width="50" height="50" rx="9" fill="none" stroke="${mix(color, 0.6)}" stroke-width="1.5" opacity=".6"/>`;
  const scale = sk.type === 'ultimate' ? 0.62 : 0.78, off = (64 - 64 * scale) / 2;
  return svg(rg(`${k}-b`, bg), `${frame}<g transform="translate(${off} ${off}) scale(${scale})">${glyph}</g>`);
}

// ---------------------------------------------------------------- class emblems for the newer classes
const emblem = (k, color, glyph) => svg(lg(`${k}-a`, [mix(color, 0.5), color, mix(color, 0.45, '#000000')], 1, 1),
  `<path d="M32 6L53 12C53 34 47 48 32 59C17 48 11 34 11 12Z" fill="url(#${k}-a)" ${S(3)}/><path d="M32 11.5L48 16C47.5 33 42.5 44 32 52.5C21.5 44 16.5 33 16 16Z" fill="none" stroke="#ffcc33" stroke-width="2.6" stroke-linejoin="round"/><g transform="translate(14 13) scale(0.56)">${glyph}</g>`);

// ---------------------------------------------------------------- weapons (normal and ornate)
const weapon = {
  greataxe: (k, l) => svg(lg(`${k}-h`, ['#d8a060', '#7a4a1a'], 1, 0) + lg(`${k}-b`, l ? ['#ffffff', '#ffd0a0', '#e0602a'] : ['#ffffff', '#d8e0ea', '#8a96aa'], 1, 1),
    `<path d="M14 58L44 12" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M14 58L44 12" stroke="url(#${k}-h)" stroke-width="4" stroke-linecap="round"/><path d="M40 8C30 2 16 8 16 20C16 26 19 30 22 32C26 26 32 24 38 24Z" fill="url(#${k}-b)" ${S()}/><path d="M44 18C54 14 62 24 58 34C56 38 52 40 48 40C48 33 46 28 42 24Z" fill="url(#${k}-b)" ${S()}/>${l ? spark(54, 50, 5) + spark(10, 14, 4) : ''}`),
  bow: (k, l) => svg(lg(`${k}-w`, l ? ['#fff3a0', '#e0a020', '#8a5a08'] : ['#e8b070', '#8a5a2a']),
    `<path d="M14 6C46 12 52 52 14 58" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M14 6C46 12 52 52 14 58" fill="none" stroke="url(#${k}-w)" stroke-width="4" stroke-linecap="round"/><path d="M14 6V58" stroke="#f4f0e0" stroke-width="2"/><path d="M10 32H54" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M10 32H54" stroke="#d8b070" stroke-width="2.2" stroke-linecap="round"/><path d="M60 32L52 27V37Z" fill="#e8eef8" ${S(1.8)}/>${l ? spark(48, 14, 5) + spark(46, 52, 4) : ''}`),
  tome: (k, l) => svg(lg(`${k}-c`, l ? ['#c8ff9a', '#3a9a3a', '#1a4a1a'] : ['#9ad86a', '#3a6a3a']),
    `<path d="M12 10H48C52 10 54 12 54 16V54H16C14 54 12 52 12 50Z" fill="url(#${k}-c)" ${S()}/><path d="M16 54V48H54" fill="none" stroke="${INK}" stroke-width="2.6"/><path d="M16 48H52V54" fill="#f4ead0" ${S(2)}/><circle cx="33" cy="28" r="9" fill="#e8ffd8" ${S(2)}/><path d="M33 21V35M26 28H40" stroke="#3a9a3a" stroke-width="2.6" stroke-linecap="round"/>${l ? spark(56, 8, 5) + spark(8, 40, 4) : ''}`),
  runesword: (k, l) => svg(lg(`${k}-bl`, l ? ['#ffffff', '#c8f4ff', '#5ad8ff'] : ['#ffffff', '#d8e8f4', '#8aa0c0'], 1, 0),
    `<g transform="rotate(45 32 32)"><path d="M32 2L37 9V41H27V9Z" fill="url(#${k}-bl)" ${S()}/><path d="M32 12V16M32 20V24M32 28V32" stroke="#2ab8ff" stroke-width="3" stroke-linecap="round"/><rect x="19" y="40" width="26" height="6" rx="2.5" fill="#d8dee8" ${S()}/><rect x="29" y="46" width="6" height="11" fill="#2a3a5a" ${S()}/><circle cx="32" cy="59.5" r="3.6" fill="#5ad8ff" ${S(2)}/></g>${l ? spark(52, 12, 5) + spark(12, 50, 4) : ''}`),
};

export const CLASS_ICONS = {
  cls_berserker: emblem('clsb', '#e04a3a', GLYPH.axe('#ffd0c0')),
  cls_ranger: emblem('clsr', '#6ab83a', GLYPH.bow('#e8ffd0')),
  cls_summoner: emblem('clss', '#4a9a5a', GLYPH.spirit('#c8ffb0')),
  cls_spellblade: emblem('clsp', '#3a8ad8', GLYPH.rune('#9ae8ff')),
  w_greataxe: weapon.greataxe('wga', false), w_greataxe_l: weapon.greataxe('wgal', true),
  w_bow: weapon.bow('wbo', false), w_bow_l: weapon.bow('wbol', true),
  w_tome: weapon.tome('wto', false), w_tome_l: weapon.tome('wtol', true),
  w_runesword: weapon.runesword('wru', false), w_runesword_l: weapon.runesword('wrul', true),
};
CLASS_ICONS.roll = svg('', `<g transform="translate(6 6) scale(0.82)">${GLYPH.wind('#9affb8')}</g>`);
CLASS_ICONS.block = svg('', `<g transform="translate(6 6) scale(0.82)">${GLYPH.shield('#d9a441')}</g>`);
// masteries (Hero panel)
CLASS_ICONS.m_weapon = emblem('mw', '#b04a3a', GLYPH.sword('#ffe0c8'));
CLASS_ICONS.m_defense = emblem('md', '#3a6ab0', GLYPH.shield('#d8e8ff'));
CLASS_ICONS.m_survival = emblem('ms', '#4a8a3a', GLYPH.leaf('#e0ffc8'));
for (const [id, sk] of Object.entries(SKILL_BY_ID)) CLASS_ICONS[id] = skillIcon(id, sk, CLASSES[sk.cls].elemColor);
for (const [cls, B] of Object.entries(BASIC)) CLASS_ICONS[cls + '_basic'] = skillIcon(cls + '_basic', { g: B.g, type: 'active' }, CLASSES[cls].elemColor);
