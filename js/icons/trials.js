// Icons for the trial content: the ten Trial Sigils, campfire food, raw meat and the Trial Warden's role badge.
// Same ink style as the hand-made set.
import { TRIALS, ROMAN_T } from '../data-trials.js';

const INK = '#24160f';
const S = (w = 2.6) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const svg = (defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${defs}</defs>${body}</svg>`;
const rg = (id, c) => `<radialGradient id="${id}" cx="40%" cy="35%" r="70%">${c.map((s, i) => `<stop offset="${(i / (c.length - 1)).toFixed(2)}" stop-color="${s}"/>`).join('')}</radialGradient>`;
const lg = (id, c) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${c.map((s, i) => `<stop offset="${(i / (c.length - 1)).toFixed(2)}" stop-color="${s}"/>`).join('')}</linearGradient>`;
const spark = (x, y, s = 4, fill = '#fff') => `<path d="M${x} ${y - s}Q${x + s * 0.2} ${y - s * 0.2} ${x + s} ${y}Q${x + s * 0.2} ${y + s * 0.2} ${x} ${y + s}Q${x - s * 0.2} ${y + s * 0.2} ${x - s} ${y}Q${x - s * 0.2} ${y - s * 0.2} ${x} ${y - s}Z" fill="${fill}"/>`;

export const TRIAL_ICONS = {};

// a rune disc in the trial's aura color with its numeral
for (const T of TRIALS) {
  const k = `sg${T.n}`, label = ROMAN_T[T.n] === 'Final' ? '★' : ROMAN_T[T.n];
  TRIAL_ICONS[`sigil_${T.n}`] = svg(rg(`${k}-a`, ['#ffffff', T.aura, '#3a2a4a']),
    `<circle cx="32" cy="32" r="27" fill="url(#${k}-a)" ${S(3)}/><circle cx="32" cy="32" r="20" fill="none" stroke="#fff8e0" stroke-width="2" stroke-dasharray="4 3" opacity=".85"/>
    <text x="32" y="${label.length > 2 ? 38 : 40}" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="${label.length > 2 ? 15 : 20}" fill="#fff" stroke="${INK}" stroke-width="1.6" paint-order="stroke">${label}</text>${spark(50, 12, 5)}`);
}

TRIAL_ICONS.trial = svg(rg('trl-a', ['#fff3c0', '#e8c070', '#7a4a1a']),
  `<circle cx="32" cy="32" r="27" fill="url(#trl-a)" ${S(3)}/><path d="M20 44L44 20M44 44L20 20" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M20 44L44 20M44 44L20 20" stroke="#f4f0e0" stroke-width="3.4" stroke-linecap="round"/><circle cx="32" cy="32" r="6" fill="#c83a2a" ${S(2)}/>`);

TRIAL_ICONS.raw_meat = svg(lg('rm-a', ['#ff9a9a', '#d84a4a', '#8a1a2a']),
  `<path d="M14 34C10 20 26 10 40 14C54 18 56 34 48 44C40 54 20 52 14 34Z" fill="url(#rm-a)" ${S()}/><path d="M24 26C30 22 38 24 42 30" fill="none" stroke="#ffe0e0" stroke-width="3" stroke-linecap="round"/><path d="M44 46L54 56" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M44 46L54 56" stroke="#f4ecd8" stroke-width="3.4" stroke-linecap="round"/><circle cx="55" cy="57" r="3.6" fill="#f4ecd8" ${S(2)}/>`);

const food = (k, body, glow) => svg(rg(`${k}-g`, ['#ffffff', glow]), `<circle cx="32" cy="32" r="29" fill="url(#${k}-g)" opacity=".35"/>${body}`);
TRIAL_ICONS.food_skewer = food('fsk', `<path d="M10 54L54 10" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M10 54L54 10" stroke="#d8b070" stroke-width="2.4" stroke-linecap="round"/>${[18, 30, 42].map((c, i) => `<rect x="${c - 7}" y="${64 - c - 7}" width="14" height="14" rx="4" transform="rotate(-45 ${c} ${64 - c})" fill="${['#b05a2a', '#e08a3a', '#8a3a1a'][i]}" ${S(2.2)}/>`).join('')}`, '#ffb07a');
TRIAL_ICONS.food_bread = food('fbr', `<path d="M8 40C8 24 20 18 32 18C44 18 56 24 56 40C56 46 52 48 46 48H18C12 48 8 46 8 40Z" fill="#e0a050" ${S()}/><path d="M20 26L24 36M30 24L32 36M40 26L38 36" stroke="#a8601a" stroke-width="2.6" stroke-linecap="round"/>`, '#ffe0a0');
TRIAL_ICONS.food_stew = food('fst', `<path d="M8 32H56C56 46 46 54 32 54C18 54 8 46 8 32Z" fill="#7a5a3a" ${S()}/><ellipse cx="32" cy="32" rx="24" ry="6" fill="#c8602a" ${S(2.2)}/><circle cx="24" cy="31" r="3" fill="#ff9a3a"/><circle cx="36" cy="33" r="3" fill="#7ad85a"/><circle cx="42" cy="30" r="2.6" fill="#e8c070"/><path d="M22 20C20 16 24 14 22 10M32 20C30 16 34 14 32 10M42 20C40 16 44 14 42 10" fill="none" stroke="#fff" stroke-width="2" opacity=".8" stroke-linecap="round"/>`, '#ffc890');
TRIAL_ICONS.food_pie = food('fpi', `<path d="M6 38L32 22L58 38Z" fill="#e8b060" ${S()}/><path d="M6 38H58V46C58 50 54 52 50 52H14C10 52 6 50 6 46Z" fill="#c8803a" ${S()}/><circle cx="24" cy="34" r="3" fill="#d83a5a" ${S(1.6)}/><circle cx="34" cy="31" r="3" fill="#d83a5a" ${S(1.6)}/><circle cx="42" cy="35" r="3" fill="#d83a5a" ${S(1.6)}/>`, '#ffb0c0');
TRIAL_ICONS.food_feast = food('ffe', `<ellipse cx="32" cy="44" rx="26" ry="8" fill="#e8e0d0" ${S()}/><path d="M14 40C14 26 24 18 32 18C40 18 50 26 50 40Z" fill="#8ad05a" ${S()}/><path d="M22 26C26 30 26 36 22 40M32 20V40M42 26C38 30 38 36 42 40" fill="none" stroke="#3a7a2a" stroke-width="2.4"/>${spark(52, 14, 5)}`, '#c8ff9a');
TRIAL_ICONS.food_starsoup = food('fss', `<path d="M8 32H56C56 46 46 54 32 54C18 54 8 46 8 32Z" fill="#4a3a8a" ${S()}/><ellipse cx="32" cy="32" rx="24" ry="6" fill="#9a7aff" ${S(2.2)}/>${spark(24, 31, 3.4, '#fff3a0')}${spark(38, 32, 3, '#fff3a0')}${spark(50, 12, 5, '#fff3a0')}${spark(14, 16, 4, '#fff')}`, '#c8b0ff');

// exploration: parchment, survey maps, waystones
TRIAL_ICONS.parchment = svg(lg('pa-a', ['#fff8e8', '#e8d8b0']), `<path d="M14 10H46C50 10 52 14 50 18V54H18C14 54 12 50 14 46Z" fill="url(#pa-a)" ${S()}/><path d="M14 46C16 42 20 42 22 46V54" fill="none" stroke="${INK}" stroke-width="2.4"/><path d="M22 22H42M22 30H42M22 38H36" stroke="#c8b890" stroke-width="2.4" stroke-linecap="round"/>`);
TRIAL_ICONS.survey_map = svg(lg('sm-a', ['#fff3d0', '#e0c890']), `<path d="M8 14L24 8L40 14L56 8V50L40 56L24 50L8 56Z" fill="url(#sm-a)" ${S()}/><path d="M24 8V50M40 14V56" stroke="#b8a070" stroke-width="2"/><path d="M14 40C20 30 30 44 36 30C40 22 46 26 50 20" fill="none" stroke="#c83a2a" stroke-width="2.6" stroke-dasharray="4 3" stroke-linecap="round"/><path d="M47 16L53 22M53 16L47 22" stroke="#c83a2a" stroke-width="3" stroke-linecap="round"/><circle cx="14" cy="40" r="3" fill="#3a8a3a" ${S(1.6)}/>`);
TRIAL_ICONS.waystone = svg(rg('ws-a', ['#ffffff', '#7ad8ff', '#1a4a7a']), `<path d="M22 56L26 14L32 6L38 14L42 56Z" fill="#a8a090" ${S()}/><circle cx="32" cy="28" r="7" fill="url(#ws-a)" ${S(2)}/><path d="M14 56H50" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`);

// the installable app and co-op join codes
TRIAL_ICONS.download = svg(lg('dl-a', ['#d8f0ff', '#5aa8ff', '#1a4ab8']), `<rect x="10" y="44" width="44" height="12" rx="5" fill="#2a3a6a" ${S()}/><path d="M24 8H40V28H50L32 46L14 28H24Z" fill="url(#dl-a)" ${S()}/>`);
TRIAL_ICONS.join_code = svg(rg('jc-a', ['#ffffff', '#9ad8ff', '#2a5ab8']), `<circle cx="22" cy="32" r="14" fill="none" stroke="${INK}" stroke-width="9"/><circle cx="42" cy="32" r="14" fill="none" stroke="${INK}" stroke-width="9"/><circle cx="22" cy="32" r="14" fill="none" stroke="url(#jc-a)" stroke-width="5"/><circle cx="42" cy="32" r="14" fill="none" stroke="#ffd24a" stroke-width="5"/>`);
