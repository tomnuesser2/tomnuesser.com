// Desktop-Scrollen (Maus, Touchpad, Tastatur):
// - Mausrad/Touchpad werden weich (schnell → langsam) angefahren.
// - Startseite: EIN Scroll-Vorgang geht höchstens bis zum nächsten Haltepunkt (Abschnittsanfang oder Hero-Karte) und läuft dort sanft aus.
//   Erst der nächste Scroll geht weiter – auch ein ganz wilder Mausrad-Wirbel rauscht nicht durch alle Abschnitte.
// - Im Hero (Animation zwischen Karten) läuft die Animation nach dem Loslassen immer bis zur nächsten Karte zu Ende.
// - Andere Seiten (z. B. Projekte): freies, weiches Scrollen ohne Haltepunkte; Touchpads bleiben dort nativ.
// - Springt etwas anderes im Seitenverlauf (Menü, Anker, Scrollbalken), bricht das Glätten sofort ab und kämpft nicht dagegen an.
import { isFinePointer, prefersReducedMotion } from '../core/dom.js';
import { snapModel } from '../core/scrollhub.js';

let target = 0, current = 0, raf = 0, active = false, lastSet = 0, lastT = 0, lastWheelAt = 0, lastAbs = 0, burst = null, swallowUntil = 0, swallowDir = 0, endT = 0, kPad = false;
const K_WHEEL = 0.12, K_PAD = 0.26;                // Anteil pro 1/60 s (zeitbasiert, also auf 60/144 Hz gleich schnell)
const max = () => document.documentElement.scrollHeight - window.innerHeight;
const stop = () => { active = false; cancelAnimationFrame(raf); };
const clampV = (v, a, b) => Math.min(b, Math.max(a, v));

function tick(now) {
  if (Math.abs(window.scrollY - lastSet) > 2) { stop(); target = current = window.scrollY; burst = null; return; }   // jemand anderes hat gescrollt
  const dt = Math.min(64, now - lastT) / 16.667; lastT = now;
  current += (target - current) * (1 - Math.pow(1 - (kPad ? K_PAD : K_WHEEL), dt));
  if (Math.abs(target - current) < 0.45) {
    current = target; active = false; lastSet = Math.round(current); window.scrollTo(0, current);
    const m = snapModel(); if (m && burst && m.stops.some((v) => Math.abs(v - current) <= 3)) { swallowUntil = performance.now() + 170; swallowDir = burst.dir; }   // Nachläufer des Wisches am Haltepunkt verschlucken
    return;
  }
  window.scrollTo(0, current); lastSet = window.scrollY;
  raf = requestAnimationFrame(tick);
}
const go = (t) => { target = clampV(t, 0, max()); if (!active) { current = window.scrollY; active = true; lastT = performance.now(); lastSet = window.scrollY; raf = requestAnimationFrame(tick); } };

// Grenzen für EINEN Scroll-Vorgang: vom Startpunkt bis höchstens zum nächsten Haltepunkt in Scrollrichtung
function limits(origin, dir, m) {
  const mx = max(), s = m.stops.map((v) => clampV(v, 0, mx));
  if (dir > 0) return [origin, s.find((v) => v > origin + 3) ?? mx];
  return [[...s].reverse().find((v) => v < origin - 3) ?? 0, origin];
}
// Vorgang zu Ende (kurze Ruhe): liegt das Ziel mitten in einer Hero-Zone, läuft die Animation bis zur nächsten Karte weiter
function endBurst() {
  const b = burst; if (!b || !b.m) return; const m = snapModel(); if (!m) return;
  for (const z of m.zones) {
    if (target < z[0] - 4 || target > z[z.length - 1] + 4 || z.some((v) => Math.abs(v - target) <= 6)) continue;
    const t = b.dir > 0 ? z.find((v) => v > b.origin + 6) : [...z].reverse().find((v) => v < b.origin - 6);
    if (t != null) go(clampV(t, b.lo, b.hi));
    break;
  }
}

export default {
  name: 'smoothScroll',
  init() {
    if (!isFinePointer() || prefersReducedMotion()) return false;
    target = current = lastSet = window.scrollY;
    window.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.defaultPrevented || document.body.classList.contains('is-locked')) return;
      if (e.target.closest?.('textarea, iframe, select, [data-native-scroll]')) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;                               // seitwärts: Browser machen lassen
      const now = performance.now(), gap = now - lastWheelAt; lastWheelAt = now;
      // Zeilen-/Seitenmodus (Firefox) in Pixel umrechnen
      const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * innerHeight * .9 : e.deltaY, adv = Math.abs(dy), dir = dy > 0 ? 1 : -1;
      const pad = e.deltaMode === 0 && adv < 40 && (gap < 60 || !Number.isInteger(e.deltaY));   // Touchpad: kleine, dichte Pixel-Schritte
      const m = snapModel();
      if (!m && pad) { if (active) stop(); target = current = window.scrollY; lastAbs = adv; return; }   // andere Seiten: Touchpad nativ
      if (m && now < swallowUntil && dir === swallowDir) { e.preventDefault(); lastAbs = adv; return; }
      e.preventDefault(); kPad = pad;
      if (m) {
        // neuer Scroll-Vorgang: Pause, andere Richtung oder deutlicher neuer Anlauf nach auslaufendem Schwung
        if (!burst || !burst.m || gap > 130 || dir !== burst.dir || (adv > lastAbs * 1.6 + 10 && gap > 24)) {
          const origin = active ? current : window.scrollY, [lo, hi] = limits(origin, dir, m);
          burst = { m: true, dir, origin, lo, hi }; if (!active) { current = window.scrollY; target = current; }
        }
        target = clampV(target + dy, burst.lo, burst.hi);
        clearTimeout(endT); endT = setTimeout(endBurst, 140);
      } else {
        burst = null; if (!active) { current = window.scrollY; target = current; }
        target = clampV(target + dy, 0, max());
      }
      lastAbs = adv;
      if (!active) { active = true; lastT = now; lastSet = window.scrollY; raf = requestAnimationFrame(tick); }
    }, { passive: false });
    window.addEventListener('scroll', () => { if (!active) { target = current = lastSet = window.scrollY; } }, { passive: true });
    window.addEventListener('keydown', (e) => {
      const m = snapModel(), t = e.target;
      if (m && !e.ctrlKey && !e.altKey && !e.metaKey && !(t && t.closest && t.closest('input, textarea, select, button, a, [contenteditable], [data-native-scroll]'))) {
        const k = e.key; let dir = 0;
        if (k === 'PageDown' || (k === ' ' && !e.shiftKey)) dir = 1; else if (k === 'PageUp' || (k === ' ' && e.shiftKey)) dir = -1;
        if (dir) { e.preventDefault(); const o = active ? target : window.scrollY, [lo, hi] = limits(o, dir, m); kPad = false; burst = { m: true, dir, origin: o, lo, hi }; go(dir > 0 ? hi : lo); return; }
      }
      if (active) stop();
    }, { passive: false });
    window.addEventListener('pointerdown', () => { if (active) stop(); }, { passive: true });
    return true;
  },
  onPage() { stop(); burst = null; target = current = lastSet = window.scrollY; },
};
