import { prefersReducedMotion } from '../core/dom.js';

let io;
export default {
  name: 'reveal',
  init() {
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) return false;
    document.body.classList.add('fx-reveal');
    io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    return true;
  },
  onPage(root) {
    if (!io) return;
    root.querySelectorAll('[data-reveal]').forEach((el, i) => {
      const group = el.closest('.b-stack, .p-group');
      if (group) el.style.transitionDelay = `${Math.min([...group.children].indexOf(el.closest('.p-card') || el), 6) * 80}ms`;
      io.observe(el);
    });
  },
};
