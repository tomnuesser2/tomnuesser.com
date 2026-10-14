import { prefersReducedMotion } from '../core/dom.js';

let items = [];
let ticking = false;

function update() {
  ticking = false;
  const vh = window.innerHeight, work = [];
  for (const it of items) {
    if (!it.frame.isConnected || it.frame.classList.contains('is-playing')) continue;
    const r = it.frame.getBoundingClientRect();
    if (r.bottom < -100 || r.top > vh + 100) continue;
    work.push([it.inner, r]);
  }
  for (const [inner, r] of work) {
    const p = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2); // -1 … 1
    const shift = Math.max(-1, Math.min(1, p)) * 5; // Prozent
    inner.style.transform = `translate3d(0, ${shift.toFixed(2)}%, 0) scale(1.14)`;
  }
}
const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };

export default {
  name: 'parallax',
  init() {
    if (prefersReducedMotion()) return false;
    document.body.classList.add('fx-parallax');
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return true;
  },
  onPage(root) {
    items = [...root.querySelectorAll('.media-frame[data-parallax]')].map(frame => ({ frame, inner: frame.querySelector('.media-inner') })).filter(i => i.inner);
    // reveal-Skalierung nach dem Einblenden an Parallax übergeben
    items.forEach(({ frame, inner }) => frame.addEventListener('transitionend', (e) => { if (e.target === inner) onScroll(); }, { once: true }));
    onScroll();
  },
};
