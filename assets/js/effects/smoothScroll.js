// Weiches Mausrad-Scrollen nur für Desktop-Mäuse. Auf dem Handy bleibt das native Scrollen unangetastet.
// - Mausrad-Rasten (auch Firefox im Zeilenmodus) werden auf Pixel umgerechnet und weich angefahren.
// - Touchpads (kleine, dichte Pixel-Schritte) bleiben nativ – sie sind schon weich, zusätzliches Glätten wirkt träge.
// - Springt etwas anderes im Seitenverlauf (Menü, Anker, Tastatur, Scrollbalken), bricht das Glätten sofort ab und kämpft nicht dagegen an.
import { isFinePointer, prefersReducedMotion } from '../core/dom.js';

let target = 0, current = 0, raf = 0, active = false, lastSet = 0, lastT = 0, lastWheelAt = 0;
const K = 0.1;                                   // Anteil pro 1/60 s (zeitbasiert, also auf 60/144 Hz gleich schnell)
const max = () => document.documentElement.scrollHeight - window.innerHeight;
const stop = () => { active = false; cancelAnimationFrame(raf); };

function tick(now) {
  if (Math.abs(window.scrollY - lastSet) > 2) { stop(); target = current = window.scrollY; return; }   // jemand anderes hat gescrollt
  const dt = Math.min(64, now - lastT) / 16.667; lastT = now;
  current += (target - current) * (1 - Math.pow(1 - K, dt));
  if (Math.abs(target - current) < 0.4) { current = target; active = false; lastSet = Math.round(current); window.scrollTo(0, current); return; }
  window.scrollTo(0, current); lastSet = window.scrollY;
  raf = requestAnimationFrame(tick);
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
      const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * innerHeight * .9 : e.deltaY;
      // Touchpad erkennen: Pixelmodus, kleine Schritte, dicht hintereinander → nativ lassen
      if (e.deltaMode === 0 && Math.abs(dy) < 40 && (gap < 60 || !Number.isInteger(e.deltaY))) { if (active) { stop(); } target = current = window.scrollY; return; }
      e.preventDefault();
      if (!active) { current = window.scrollY; target = current; }
      target = Math.max(0, Math.min(max(), target + dy));
      if (!active) { active = true; lastT = now; lastSet = window.scrollY; raf = requestAnimationFrame(tick); }
    }, { passive: false });
    window.addEventListener('scroll', () => { if (!active) { target = current = lastSet = window.scrollY; } }, { passive: true });
    window.addEventListener('keydown', () => { if (active) stop(); }, { passive: true });
    window.addEventListener('pointerdown', () => { if (active) stop(); }, { passive: true });
    return true;
  },
  onPage() { stop(); target = current = lastSet = window.scrollY; },
};
