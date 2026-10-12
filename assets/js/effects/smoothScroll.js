// Weiches Mausrad-Scrollen nur für Desktop-Mäuse. Auf dem Handy bleibt das native Scrollen unangetastet.
import { isFinePointer, prefersReducedMotion } from '../core/dom.js';

let target = 0, current = 0, raf = 0, active = false;
const ease = 0.1;

function tick() {
  current += (target - current) * ease;
  if (Math.abs(target - current) < 0.4) { current = target; active = false; window.scrollTo(0, current); return; }
  window.scrollTo(0, current);
  raf = requestAnimationFrame(tick);
}
const max = () => document.documentElement.scrollHeight - window.innerHeight;

export default {
  name: 'smoothScroll',
  init() {
    if (!isFinePointer() || prefersReducedMotion()) return false;
    target = current = window.scrollY;
    window.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.defaultPrevented || document.body.classList.contains('is-locked')) return;
      if (e.target.closest?.('textarea, iframe')) return;
      e.preventDefault();
      if (!active) { current = window.scrollY; target = current; }
      target = Math.max(0, Math.min(max(), target + e.deltaY));
      if (!active) { active = true; raf = requestAnimationFrame(tick); }
    }, { passive: false });
    window.addEventListener('scroll', () => { if (!active) { target = current = window.scrollY; } }, { passive: true });
    return true;
  },
  onPage() { target = current = window.scrollY; },
};
