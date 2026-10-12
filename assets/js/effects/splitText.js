import { prefersReducedMotion } from '../core/dom.js';

let io;
export default {
  name: 'split',
  init() {
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) return false;
    document.body.classList.add('fx-split');
    io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -5% 0px', threshold: 0.2 });
    return true;
  },
  onPage(root) {
    if (!io) return;
    root.querySelectorAll('[data-split]').forEach((el) => {
      if (el.dataset.splitDone) return;
      const text = el.textContent;
      el.setAttribute('aria-label', text);
      el.textContent = '';
      text.split(/(\s+)/).forEach((part, i, arr) => {
        if (/^\s+$/.test(part)) { el.append(' '); return; }
        if (!part) return;
        const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
        const s = document.createElement('span'); s.textContent = part;
        w.style.setProperty('--wi', String(Math.floor(i / 2)));
        w.append(s); el.append(w);
      });
      el.dataset.splitDone = '1';
      io.observe(el);
    });
  },
};
