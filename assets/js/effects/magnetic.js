import { isFinePointer, prefersReducedMotion } from '../core/dom.js';

export default {
  name: 'magnetic',
  init() { return isFinePointer() && !prefersReducedMotion(); },
  onPage(root) {
    root.querySelectorAll('[data-magnetic]').forEach((el) => {
      if (el.dataset.mag) return; el.dataset.mag = '1';
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - (r.left + r.width / 2)) / r.width, y = (e.clientY - (r.top + r.height / 2)) / r.height;
        el.style.transition = 'transform .15s linear';
        el.style.transform = `translate(${x * 14}px, ${y * 14}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transition = 'transform .8s cubic-bezier(.22,1,.36,1)'; el.style.transform = ''; });
    });
  },
};
