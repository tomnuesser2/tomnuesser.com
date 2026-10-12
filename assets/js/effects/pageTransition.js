// Blenden-Übergang wie eine Kamerablende (Iris): schließt sich um den Klickpunkt, öffnet sich auf der neuen Seite.
import { prefersReducedMotion } from '../core/dom.js';

let veil, x = 0.5, y = 0.5;
const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const maxR = () => Math.hypot(innerWidth, innerHeight) + 60;

function tween(from, to, ms) {
  return new Promise((res) => {
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / ms);
      veil.style.setProperty('--r', `${from + (to - from) * ease(t)}px`);
      t < 1 ? requestAnimationFrame(step) : res();
    };
    requestAnimationFrame(step);
  });
}

export default {
  name: 'pageTransition',
  init() {
    if (prefersReducedMotion()) return false;
    veil = document.createElement('div'); veil.className = 'iris'; veil.setAttribute('aria-hidden', 'true');
    document.body.append(veil);
    document.addEventListener('pointerdown', (e) => { x = e.clientX / innerWidth; y = e.clientY / innerHeight; }, { capture: true, passive: true });
    document.addEventListener('keydown', () => { x = 0.5; y = 0.5; }, { capture: true, passive: true });
    return true;
  },
  async beforeNavigate() {
    veil.style.setProperty('--x', `${x * 100}%`); veil.style.setProperty('--y', `${y * 100}%`);
    veil.style.setProperty('--r', `${maxR()}px`); veil.style.visibility = 'visible';
    await tween(maxR(), 0, 600);
  },
  async afterNavigate() {
    veil.style.setProperty('--x', '50%'); veil.style.setProperty('--y', '50%');
    await tween(0, maxR(), 800);
    veil.style.visibility = 'hidden';
  },
};
