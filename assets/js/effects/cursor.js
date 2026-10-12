import { isFinePointer, prefersReducedMotion } from '../core/dom.js';

export default {
  name: 'cursor',
  init() {
    if (!isFinePointer() || prefersReducedMotion()) return false;
    const c = document.createElement('div'); c.className = 'cursor'; c.setAttribute('aria-hidden', 'true');
    document.body.append(c);
    let x = 0, y = 0, cx = 0, cy = 0;
    addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; c.classList.add('is-on'); }, { passive: true });
    document.addEventListener('pointerleave', () => c.classList.remove('is-on'));
    document.addEventListener('pointerover', (e) => c.classList.toggle('is-big', !!e.target.closest?.('[data-cursor], .p-card')));
    (function loop() { cx += (x - cx) * 0.22; cy += (y - cy) * 0.22; c.style.transform = `translate3d(${cx}px, ${cy}px, 0)`; requestAnimationFrame(loop); })();
    return true;
  },
};
