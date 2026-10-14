// Scroll-Szenen: berechnet pro Projekt den Fortschritt p (0–1) und gibt ihn an die gewählte Variante (assets/js/scenes/*).
import { prefersReducedMotion } from '../core/dom.js';
import { pick } from '../scenes/index.js';

let scenes = [], ticking = false;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

function update() {
  ticking = false;
  const vh = window.innerHeight, vw = window.innerWidth, work = [];
  for (const sc of scenes) {
    if (!sc.track.isConnected) continue;
    const r = sc.track.getBoundingClientRect();
    if (r.bottom < -vh * 0.2 || r.top > vh * 1.2) continue;
    work.push([sc, r, Math.max(1, r.height - sc.stage.offsetHeight)]);
  }
  for (const [sc, r, total] of work) {
    try { sc.v.update(sc, clamp(-r.top / total), { vw, vh }); } catch (e) { console.error('[scenes]', sc.v.name, e); }
  }
}
const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };

export default {
  name: 'scenes',
  init() {
    if (prefersReducedMotion()) return false;
    document.body.classList.add('fx-scenes');
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll, { passive: true });
    return true;
  },
  onPage(root) {
    scenes = [...root.querySelectorAll('[data-scene]')].map(el => {
      const cache = {};
      const sc = { el, v: pick(el.dataset.anim), track: el.querySelector('.scene__track'), stage: el.querySelector('.scene__stage'),
        q(sel) { return cache[sel] || (cache[sel] = el.querySelector(sel)); } };
      try { sc.v.init?.(sc); } catch (e) { console.error('[scenes]', e); }
      return sc;
    });
    onScroll();
    requestAnimationFrame(update);
  },
};
