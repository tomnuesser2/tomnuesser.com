// Iris: Ein Kreis (wie eine Kamerablende) wächst aus der Bildmitte und öffnet das Projekt.
import { h } from '../core/dom.js';
import { seg, io3, sm, setVars, mediaNode, shadeNode, infoNode, ctaNode, idxNode, infoCta } from './shared.js';

export default {
  name: 'iris', label: 'Iris – Kreisblende öffnet sich aus der Mitte', len: 240,
  build({ pr, i, n }) {
    return [idxNode(i, n), h('div', { class: 'vi__ring' }), h('div', { class: 'vi__media' }, mediaNode(pr, i), shadeNode()),
      h('h2', { class: 'vi__title' }, pr.title || pr.slug), infoNode(pr, { title: false }), ctaNode(pr)];
  },
  update(sc, p, { vw, vh }) {
    const e = io3(seg(p, .02, .42)), R = Math.hypot(vw, vh) / 2 * 1.02, r = e * R;
    const m = sc.q('.vi__media');
    m.style.clipPath = `circle(${r.toFixed(1)}px at 50% 50%)`;
    m.firstChild.style.transform = `scale(${(1.3 - .3 * e + .05 * p).toFixed(4)})`;
    const ring = sc.q('.vi__ring');
    ring.style.width = ring.style.height = `${(2 * r + 18).toFixed(1)}px`;
    ring.style.opacity = String(Math.min(1, e * 6) * (1 - seg(p, .34, .44)));
    sc.q('.vi__title').style.opacity = String(1 - seg(p, .36, .46));
    setVars(sc.stage, { '--d': (.1 + .25 * seg(p, .4, .55)).toFixed(3) });
    infoCta(sc, p, { inA: .44, inB: .56, outA: .84, outB: .94, cA: .5, cB: .6 });
  },
};
