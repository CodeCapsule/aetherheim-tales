// Co-op join codes. Every hero has a short code; the join code you share is your server's number plus that code
// (3K7-QPM: server 3, code K7QPM). A friend who enters it, in the Online window, on the title screen or through an
// invite link (?join=3K7QPM), moves to your server, joins your party without an invitation popup and appears beside
// you. Presence only carries a hash of the code, so the code itself stays with the people you gave it to.
import { mp, mpEnabled, serverName, setServer } from './mp.js';

const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0 or 1 to misread
const PENDING = 'aetherheim_join'; // a code waiting for the game to connect (title screen or invite link)
const WAIT_SECS = 25; // how long to look for the friend before giving up
const RESEND_SECS = 3;

export const newCoopCode = () => Array.from({ length: 5 }, () => ABC[(Math.random() * ABC.length) | 0]).join('');
export const isCoopCode = (c) => /^[A-HJ-NP-Z2-9]{5}$/.test(c || '');
// a short public fingerprint of a code (FNV-1a), published in presence so friends can be found by it
export function coopHash(code) {
  let x = 0x811c9dc5;
  for (const ch of 'aetherheim:' + code) { x ^= ch.charCodeAt(0); x = Math.imul(x, 0x01000193) >>> 0; }
  return x.toString(36);
}
// "3k7-qpm", "3K7QPM" -> { server: 'S3', code: 'K7QPM', text: '3K7-QPM' }, or null
export function parseJoinCode(raw) {
  const s = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = /^([1-6])([A-HJ-NP-Z2-9]{5})$/.exec(s);
  return m ? { server: 'S' + m[1], code: m[2], text: `${s.slice(0, 3)}-${s.slice(3)}` } : null;
}
// keep a code for after the game has loaded (and pick its server now, so the game connects there first)
export function setPendingJoin(raw) {
  const c = parseJoinCode(raw); if (!c) return null;
  setServer(c.server);
  try { sessionStorage.setItem(PENDING, c.text); } catch { /* storage unavailable */ }
  return c;
}
function takePendingJoin() {
  try { const v = sessionStorage.getItem(PENDING); sessionStorage.removeItem(PENDING); return v; } catch { return null; }
}

const C = {
  coopInit() {
    if (!isCoopCode(this.S.coopCode)) this.S.coopCode = newCoopCode();
    this.coop = null; this.coopT = 0;
    const raw = takePendingJoin();
    if (raw) this.after(0.8, () => this.coopJoin(raw));
  },
  joinCode() { const s = mp.server.slice(1) + this.S.coopCode; return `${s.slice(0, 3)}-${s.slice(3)}`; },
  joinLink() { return `${location.origin}${location.pathname}?join=${this.joinCode().replace('-', '')}`; },
  coopCodeOk(code) { return code === this.S.coopCode; },
  coopHashNow() { return coopHash(this.S.coopCode); },
  newJoinCode() {
    this.S.coopCode = newCoopCode(); this.mpTrackNow(); this.save();
    this.ui.toast(`New join code: ${this.joinCode()}. The old one no longer works.`, 'good');
    this.ui.refreshPanel();
  },
  // share the invite link (the phone's share sheet, or the clipboard)
  async shareJoin() {
    const code = this.joinCode(), url = this.joinLink(), text = `Play Aetherheim Tales with me! Join code ${code}`;
    try {
      if (navigator.share) { await navigator.share({ title: 'Aetherheim Tales', text, url }); return; }
    } catch (e) { if (e?.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(`${text}: ${url}`); this.ui.toast('Invite link copied: paste it to your friend', 'good'); } catch { this.ui.toast(`Your join code is ${code}`, 'good'); }
  },
  async copyJoinCode() {
    try { await navigator.clipboard.writeText(this.joinCode()); this.ui.toast(`Copied ${this.joinCode()}`, 'good'); } catch { this.ui.toast(`Your join code is ${this.joinCode()}`, 'good'); }
  },
  // enter a friend's code: go to their server, find them and ask to join
  coopJoin(raw) {
    const c = parseJoinCode(raw);
    if (!c) { this.ui.toast('A join code has 6 letters and numbers, like 3K7-QPM', 'warn'); return false; }
    if (!mpEnabled()) { this.ui.toast('Co-op works on the public website and the installed app', 'warn'); return false; }
    if (c.code === this.S.coopCode) { this.ui.toast('That is your own join code: send it to a friend', 'warn'); return false; }
    if (this.dg || this.war || this.trial) { this.ui.toast(this.trial ? 'Finish the trial first' : this.war ? 'Finish the battle first' : 'Leave the dungeon first', 'warn'); return false; }
    if (mp.server !== c.server) this.mpSwitchServer(c.server);
    this.coop = { ...c, hash: coopHash(c.code), until: this.time + WAIT_SECS, sentAt: -99 };
    this.ui.toast(`Looking for ${c.text} on ${serverName(c.server)}…`);
    this.coopTick(0, true);
    return true;
  },
  coopHost() { const J = this.coop; if (!J) return null; for (const [key, pr] of mp.peers) if (pr.info.jh === J.hash) return key; return null; },
  coopWaitingFor(key) { return !!this.coop && this.coopHost() === key; },
  coopBusy(key) { if (this.coopWaitingFor(key)) this.coop = null; },
  // every second while a join is waiting (and on each presence change): find the friend and ask to join
  coopTick(dt, now = false) {
    const J = this.coop; if (!J) return;
    this.coopT -= dt; if (this.coopT > 0 && !now) return; this.coopT = 1;
    if (this.time > J.until) {
      this.coop = null;
      this.ui.toast(`Nobody with join code ${J.text} is online on ${serverName(J.server)}. Check the code, and ask your friend to keep the game open.`, 'warn');
      return;
    }
    if (mp.status !== 'online') return;
    const key = this.coopHost(); if (!key) return;
    if (this.partyHas(key)) { this.coopJoined(key); return; }
    if (this.time - J.sentAt < RESEND_SECS) return;
    J.sentAt = this.time;
    this.partySend('join', { to: key, code: J.code });
  },
  // in the party: appear beside the friend if you are both out in the world
  coopJoined(key) {
    this.coop = null;
    const pr = mp.peers.get(key); if (!pr) return;
    if (this.ui.panelName === 'online') this.ui.closePanels();
    if (pr.info.map !== 'world' || !pr.net.w) { this.ui.toast(`You are in ${pr.info.name}'s party. They are in ${pr.info.zone || 'another area'} right now.`, 'good'); return; }
    this.coopGoTo(key);
  },
  // travel to a party member (the Online window's Go to button, and right after joining)
  coopGoTo(key) {
    const pr = mp.peers.get(key);
    if (!pr || !this.partyHas(key)) return;
    if (this.dg || this.war || this.trial) { this.ui.toast('Leave this area first', 'warn'); return; }
    if (pr.info.map !== 'world' || !pr.net.w) { this.ui.toast(`${pr.info.name} is in ${pr.info.zone || 'another area'}`, 'warn'); return; }
    this.ui.closePanels();
    this.castBar(`Joining ${pr.info.name}`, 1.2, () => this.coopArrive(key));
  },
  coopArrive(key) {
    const pr = mp.peers.get(key), p = this.player;
    if (!pr || this.dg || this.war || this.trial || pr.info.map !== 'world' || !pr.net.w) return;
    this.fx.pillar(p.pos, 0x7ad8ff, 1.6, 10, 0.8);
    const [x, z] = this.world.nearestFree(pr.net.x + 1.6, pr.net.z + 1.2);
    p.pos.set(x, this.world.heightAt(x, z), z); p.path = []; this.autoPathing = false; this.ui.setAutoPath(false);
    this.cam.target.copy(p.pos);
    if (this.pet) this.pet.pos.set(x - 1.5, p.pos.y, z - 1);
    this.fx.pillar(p.pos, 0x7ad8ff, 1.6, 10, 1.0); this.sfx.play('cast');
    this.mpLastSent = null; // tell everyone where we are now
    this.ui.toast(`You are with ${pr.info.name}. Party members nearby share EXP from kills.`, 'good');
  },
};

export function installCoop(Game) { Object.assign(Game.prototype, C); }
