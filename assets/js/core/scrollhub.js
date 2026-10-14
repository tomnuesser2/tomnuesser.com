// Ein gemeinsamer Scroll-Takt für alle scrollgesteuerten Blöcke (statt vieler eigener Listener).
// track(el, fn): fn(rect, vh) läuft bei jedem Scroll, solange el in der Nähe des Bildschirms ist.
import { prefersReducedMotion } from './dom.js';
const subs = new Set(); let queued = false, bound = false;
const run = () => {
  queued = false; const vh = innerHeight, live = [];
  // 1) alle Maße lesen (ein einziges Layout), 2) erst danach die Blöcke zeichnen lassen – sonst erzwingt jeder Block ein neues Layout
  for (const s of subs) {
    if (!s.el.isConnected) { subs.delete(s); continue; }
    const r = s.el.getBoundingClientRect();
    if (r.bottom < -vh * .5 || r.top > vh * 1.5) continue;
    live.push([s, r]);
  }
  for (const [s, r] of live) { try { s.fn(r, vh); } catch (e) { console.error('[scrollhub]', e); } }
};
export const kick = () => { if (!queued) { queued = true; requestAnimationFrame(run); } };
export function track(el, fn) {
  subs.add({ el, fn });
  if (!bound) { bound = true; addEventListener('scroll', kick, { passive: true }); addEventListener('resize', kick, { passive: true }); }
  kick(); requestAnimationFrame(kick); setTimeout(() => initSnapStop(), 0);
}
export const still = () => prefersReducedMotion();
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
// Fortschritt (0–1) durch eine hohe Scroll-Strecke mit klebender Bühne.
export const trackProgress = (r, stageH) => clamp(-r.top / Math.max(1, r.height - stageH));

// Handy: beim Scroll-Stopp den restlichen Schwung (Auslaufen des Wischens) entfernen und für ms den Scroll sperren – z. B. solange eine zeitgesteuerte Animation läuft.
// So rauscht man nicht an Abschnitten vorbei und die Animation landet immer im perfekten Bild. Am Computer (Maus) passiert nichts.
let holdT = 0, held = false;
const coarse = () => matchMedia('(pointer: coarse)').matches;
export function releaseScroll() {
  clearTimeout(holdT); if (!held) return; held = false;
  const de = document.documentElement; de.style.overflow = ''; de.style.overscrollBehavior = ''; document.body.style.overflow = '';
}
export function holdScroll(ms = 200) {
  if (!coarse() || ms <= 0) return;
  const de = document.documentElement, y = window.scrollY;
  if (!held) { held = true; de.style.overflow = 'hidden'; de.style.overscrollBehavior = 'none'; document.body.style.overflow = 'hidden'; window.scrollTo(0, y); }
  clearTimeout(holdT); holdT = setTimeout(releaseScroll, Math.min(9000, ms));
}

// Handy: Jeder Abschnitt hält beim Erreichen seines Anfangs an. Schneller Wisch → schnell los, kurz vor dem Anfang sanft abbremsen, bis der Abschnitt perfekt sitzt – erst der nächste Wisch scrollt weiter.
let snapOn = false, lastY = 0, fingers = 0, snapping = false, snapT = 0, gestY = 0;
const stopFns = [];
// Abschnitte können eigene Anhaltepunkte melden (absolute Scroll-Positionen). settle: Läuft eine Animation zwischen zwei Punkten, wird sie nach dem Loslassen zu Ende geführt.
export function registerStops(fn, settle = false) { const z = { fn, settle }; stopFns.push(z); return () => { const i = stopFns.indexOf(z); if (i >= 0) stopFns.splice(i, 1); }; }
function extraStops() { const o = []; for (const z of stopFns) { try { for (const v of z.fn() || []) o.push(Math.round(v)); } catch { /* weg */ } } return o; }
function snapTargets() {
  const out = [...extraStops()]; for (const b of document.querySelectorAll('.page[data-page="home"] [data-bi]')) out.push(Math.round(b.getBoundingClientRect().top + scrollY));
  return out;
}
export function initSnapStop() {
  if (snapOn || !coarse() || prefersReducedMotion()) return; snapOn = true; lastY = scrollY;
  addEventListener('touchstart', e => { fingers = e.touches.length; snapping = false; if (fingers === 1) gestY = scrollY; }, { passive: true });
  addEventListener('touchend', e => { fingers = e.touches.length; }, { passive: true });
  addEventListener('touchcancel', () => { fingers = 0; }, { passive: true });
  let settleT = 0, dirLast = 1;
  const settle = () => {
    if (fingers || snapping || held) return; const y = scrollY, vh = innerHeight;
    for (const z of stopFns) { if (!z.settle) continue; let st; try { st = (z.fn() || []).map(Math.round).sort((a, b) => a - b); } catch { continue; } if (st.length < 2) continue;
      if (y < st[0] - 4 || y > st[st.length - 1] + 4) continue; if (st.some((v) => Math.abs(v - y) <= 6)) return;
      const t = dirLast >= 0 ? st.find((v) => v > y) : [...st].reverse().find((v) => v < y); if (t == null || Math.abs(t - y) > vh * 1.6) return;
      snapping = true; scrollTo({ top: t, behavior: 'smooth' }); clearTimeout(snapT); snapT = setTimeout(() => { snapping = false; lastY = scrollY; }, 900); return; }
    // Kräftiger Wisch, der kurz vor dem nächsten Abschnittsanfang ausläuft → bis dahin weiterschicken (leichter Wisch bleibt wo er ist)
    if (!document.querySelector('.page[data-page="home"]')) return;
    const trav = Math.abs(y - gestY); if (trav < vh * .45) return;
    const dir = dirLast >= 0 ? 1 : -1, near = snapTargets().filter((v) => dir > 0 ? (v > y + 6 && v - y < vh * .5) : (v < y - 6 && y - v < vh * .5)).sort((a, b) => dir > 0 ? a - b : b - a)[0];
    if (near != null) { snapping = true; scrollTo({ top: near, behavior: 'smooth' }); clearTimeout(snapT); snapT = setTimeout(() => { snapping = false; lastY = scrollY; }, 900); }
  };
  addEventListener('scroll', () => {
    const y = scrollY, d = y - lastY; lastY = y; if (Math.abs(d) > 0) dirLast = d > 0 ? 1 : -1;
    clearTimeout(settleT); settleT = setTimeout(settle, 170);
    if (snapping || held || fingers || Math.abs(d) < 14 || !document.querySelector('.page[data-page="home"]')) return;       // nur während des Auslaufens (Finger weg) und bei echter Fahrt
    const dir = d > 0 ? 1 : -1, vh = innerHeight;
    // nächster Abschnittsanfang, den man in Fahrtrichtung gleich erreicht/überfahren hat
    const t = snapTargets().filter(v => dir > 0 ? (v > y - d + 4 && v <= y + 4) : (v < y - d - 4 && v >= y - 4)).sort((a, b) => dir > 0 ? b - a : a - b)[0];
    if (t == null || Math.abs(t - y) > vh) return;
    snapping = true; scrollTo({ top: t, behavior: 'smooth' });            // bricht das Auslaufen ab und gleitet sanft an den Anfang
    clearTimeout(snapT); snapT = setTimeout(() => { snapping = false; lastY = scrollY; }, 650);
  }, { passive: true });
}
