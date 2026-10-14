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
  kick(); requestAnimationFrame(kick);
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
