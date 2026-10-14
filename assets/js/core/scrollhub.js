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
let snapOn = false, lastY = 0, fingers = 0, snapping = false;
function snapTargets() {
  const out = []; for (const b of document.querySelectorAll('main [data-bi]')) out.push(Math.round(b.getBoundingClientRect().top + scrollY));
  return out;
}
export function initSnapStop() {
  if (snapOn || !coarse() || prefersReducedMotion()) return; snapOn = true; lastY = scrollY;
  addEventListener('touchstart', e => { fingers = e.touches.length; snapping = false; }, { passive: true });
  addEventListener('touchend', e => { fingers = e.touches.length; }, { passive: true });
  addEventListener('touchcancel', () => { fingers = 0; }, { passive: true });
  addEventListener('scroll', () => {
    const y = scrollY, d = y - lastY; lastY = y;
    if (snapping || held || fingers || Math.abs(d) < 14) return;       // nur während des Auslaufens (Finger weg) und bei echter Fahrt
    const dir = d > 0 ? 1 : -1, vh = innerHeight;
    // nächster Abschnittsanfang, den man in Fahrtrichtung gleich erreicht/überfahren hat
    const t = snapTargets().filter(v => dir > 0 ? (v > y - d + 4 && v <= y + 4) : (v < y - d - 4 && v >= y - 4)).sort((a, b) => dir > 0 ? b - a : a - b)[0];
    if (t == null || Math.abs(t - y) > vh) return;
    snapping = true;
    const de = document.documentElement; de.style.overflow = 'hidden'; document.body.style.overflow = 'hidden'; // Schwung entfernen
    const y0 = scrollY, dist = t - y0, T = 360 + Math.min(300, Math.abs(dist) * .6), s = performance.now();
    scrollTo(0, y0);
    const step = now => {
      const k = Math.min(1, (now - s) / T), e = 1 - Math.pow(1 - k, 3);
      scrollTo(0, y0 + dist * e);
      if (k < 1) requestAnimationFrame(step);
      else { lastY = scrollY; if (!held) { de.style.overflow = ''; document.body.style.overflow = ''; } setTimeout(() => { snapping = false; }, 80); }
    };
    requestAnimationFrame(step);
  }, { passive: true });
}
