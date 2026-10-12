// Words: Der Kurztext füllt sich Wort für Wort schwarz, während man scrollt (Scroll-Reveal-Text).
import { h } from '../core/dom.js';
import { seg, io3, clamp, mediaNode, rolesOf, ctaNode, idxNode, infoCta, pad } from './shared.js';

export default {
  name: 'words', label: 'Words – Text füllt sich Wort für Wort, kleines Bild darüber', len: 260, light: true,
  build({ pr, i, n }) {
    const text = pr.summary || pr.title || '';
    const roles = rolesOf(pr);
    return [idxNode(i, n), h('div', { class: 'vw__wrap' },
      h('div', { class: 'vw__img' }, mediaNode(pr, i)),
      h('p', { class: 'vw__label' }, `${pad(i + 1)} — ${pr.title || pr.slug}`),
      h('p', { class: 'vw__text' }, text.split(/\s+/).filter(Boolean).map(w => h('span', {}, w + ' '))),
      roles.length ? h('p', { class: 'scene__roles vw__roles' }, roles.map(r => h('span', {}, r))) : null), ctaNode(pr)];
  },
  update(sc, p) {
    const e = io3(seg(p, 0, .18));
    const img = sc.q('.vw__img');
    img.style.clipPath = `inset(${((1 - e) * 34).toFixed(1)}% round 12px)`;
    img.style.transform = `translate3d(0,${((1 - e) * 24).toFixed(1)}px,0)`;
    const words = sc.words || (sc.words = [...sc.el.querySelectorAll('.vw__text span')]);
    const N = words.length, f = seg(p, .1, .7) * (N + 4);
    words.forEach((w, k) => { w.style.opacity = (.14 + .86 * clamp(f - k)).toFixed(2); });
    infoCta(sc, p, { inA: 1, inB: 1.1, cA: .72, cB: .8 });
  },
};
